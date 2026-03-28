package com.medapath.backend.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

@Service
@Slf4j
public class GeminiService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public GeminiService(
            @Value("${google.api.key:}") String apiKey,
            @Value("${google.gemini.model:gemini-3-flash-preview}") String model) {
        this.apiKey = apiKey;
        this.model = model;
        this.objectMapper = new ObjectMapper();
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .build();
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    public GeminiAnalysisResult analyzeSymptoms(String symptomText, String severity, String duration, String imagePath) {
        if (!isAvailable()) {
            return null;
        }

        try {
            String prompt = buildPrompt(symptomText, severity, duration);
            Map<String, Object> requestBody = buildRequestBody(prompt, imagePath);

            String responseJson = restClient.post()
                    .uri("/models/{model}:generateContent", model)
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            return parseResponse(responseJson);
        } catch (Exception e) {
            log.warn("Gemini API call failed, falling back to keyword triage: {}", e.getMessage());
            return null;
        }
    }

    private String buildPrompt(String symptomText, String severity, String duration) {
        return """
                You are a medical triage assistant for a healthcare app called MediPath. \
                Analyze the following patient symptoms and provide a structured assessment. \
                This is NOT a diagnosis — it is informational triage guidance only.

                Patient reports:
                - Symptoms: %s
                - Severity (self-reported): %s
                - Duration: %s

                Respond ONLY with valid JSON in this exact format, no markdown or explanation:
                {
                  "primaryCondition": "Most likely concern (e.g., 'Possible upper respiratory infection')",
                  "possibleConditions": ["Condition 1", "Condition 2", "Condition 3"],
                  "urgencyLevel": "low|medium|high|emergency",
                  "advice": "Brief actionable medical guidance (2-3 sentences)",
                  "careTypeSuggested": "primary_care|urgent_care|emergency|specialty",
                  "imageNote": "If an image was provided, note what you observed. Otherwise null"
                }

                Rules:
                - urgencyLevel must be one of: low, medium, high, emergency
                - careTypeSuggested must be one of: primary_care, urgent_care, emergency, specialty
                - Be conservative — when in doubt, suggest higher urgency
                - Always include a disclaimer tone in advice (e.g., "consult a healthcare provider")
                - possibleConditions should have exactly 3 entries
                """.formatted(symptomText, severity, duration);
    }

    private Map<String, Object> buildRequestBody(String prompt, String imagePath) {
        List<Map<String, Object>> parts = new ArrayList<>();

        // Per Gemini docs: place image before text for optimal results
        if (imagePath != null) {
            try {
                Path path = Path.of(imagePath);
                if (Files.exists(path)) {
                    byte[] imageBytes = Files.readAllBytes(path);
                    String base64 = Base64.getEncoder().encodeToString(imageBytes);
                    String mimeType = Files.probeContentType(path);
                    if (mimeType == null) mimeType = "image/jpeg";

                    parts.add(Map.of(
                            "inline_data", Map.of(
                                    "mime_type", mimeType,
                                    "data", base64
                            )
                    ));
                }
            } catch (Exception e) {
                log.warn("Failed to read image for Gemini: {}", e.getMessage());
            }
        }

        parts.add(Map.of("text", prompt));

        return Map.of(
                "contents", List.of(Map.of("parts", parts)),
                "generationConfig", Map.of(
                        "temperature", 0.3,
                        "maxOutputTokens", 1024
                )
        );
    }

    private GeminiAnalysisResult parseResponse(String responseJson) throws Exception {
        JsonNode root = objectMapper.readTree(responseJson);
        JsonNode candidates = root.path("candidates");
        if (candidates.isEmpty()) {
            log.warn("Gemini returned no candidates");
            return null;
        }

        String text = candidates.get(0)
                .path("content")
                .path("parts")
                .get(0)
                .path("text")
                .stringValue();

        if (text == null) {
            log.warn("Gemini response text was null");
            return null;
        }

        // Strip markdown code fences if present
        text = text.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();

        JsonNode result = objectMapper.readTree(text);

        List<String> conditions = new ArrayList<>();
        JsonNode condArray = result.path("possibleConditions");
        if (condArray.isArray()) {
            for (JsonNode c : condArray) {
                conditions.add(c.stringValue());
            }
        }

        return new GeminiAnalysisResult(
                textOrDefault(result, "primaryCondition", "General health concern"),
                conditions,
                textOrDefault(result, "urgencyLevel", "low"),
                textOrDefault(result, "advice", "Please consult a healthcare provider."),
                textOrDefault(result, "careTypeSuggested", "primary_care"),
                result.path("imageNote").stringValue()
        );
    }

    private String textOrDefault(JsonNode node, String field, String defaultValue) {
        return node.path(field).stringValue(defaultValue);
    }

    public record GeminiAnalysisResult(
            String primaryCondition,
            List<String> possibleConditions,
            String urgencyLevel,
            String advice,
            String careTypeSuggested,
            String imageNote
    ) {}
}
