package com.medapath.backend.service;

import com.medapath.backend.dto.ChatResponse;
import com.medapath.backend.model.ChatMessage;
import com.medapath.backend.model.PatientSession;
import com.medapath.backend.model.SymptomAssessment;
import com.medapath.backend.repository.ChatMessageRepository;
import com.medapath.backend.repository.SymptomAssessmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final SymptomAssessmentRepository assessmentRepository;
    private final IntakeService intakeService;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatResponse chat(Long sessionId, String userMessage) {
        PatientSession session = intakeService.getSession(sessionId);
        SymptomAssessment assessment = assessmentRepository.findTopBySessionIdOrderByCreatedAtDesc(sessionId);

        if (assessment == null) {
            throw new RuntimeException("No analysis found for session: " + sessionId);
        }

        // Load existing conversation
        List<ChatMessage> history = chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);

        // Save the user message
        ChatMessage userMsg = ChatMessage.builder()
                .sessionId(sessionId)
                .role("user")
                .content(userMessage)
                .build();
        chatMessageRepository.save(userMsg);
        history.add(userMsg);

        // Build Gemini multi-turn request
        String reply = callGeminiChat(session, assessment, history);

        // Save the AI reply
        ChatMessage aiMsg = ChatMessage.builder()
                .sessionId(sessionId)
                .role("model")
                .content(reply)
                .build();
        chatMessageRepository.save(aiMsg);
        history.add(aiMsg);

        // Build response with full history
        List<ChatResponse.MessageDto> historyDtos = history.stream()
                .map(m -> ChatResponse.MessageDto.builder()
                        .role(m.getRole())
                        .content(m.getContent())
                        .timestamp(m.getCreatedAt().toString())
                        .build())
                .toList();

        return ChatResponse.builder()
                .reply(reply)
                .history(historyDtos)
                .build();
    }

    public List<ChatResponse.MessageDto> getHistory(Long sessionId) {
        List<ChatMessage> history = chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        return history.stream()
                .map(m -> ChatResponse.MessageDto.builder()
                        .role(m.getRole())
                        .content(m.getContent())
                        .timestamp(m.getCreatedAt().toString())
                        .build())
                .toList();
    }

    private String callGeminiChat(PatientSession session, SymptomAssessment assessment, List<ChatMessage> history) {
        if (!geminiService.isAvailable()) {
            return "I'm sorry, the AI assistant is currently unavailable. Please consult with your healthcare provider directly.";
        }

        try {
            // Build the system context as the first "user" turn
            String systemContext = buildSystemContext(session, assessment);

            List<Map<String, Object>> contents = new ArrayList<>();

            // First turn: system context + model acknowledgment
            contents.add(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", systemContext))
            ));
            contents.add(Map.of(
                    "role", "model",
                    "parts", List.of(Map.of("text",
                            "I understand. I'm MedaPath's AI health assistant. I have the patient's " +
                            "symptom details and analysis. I'll provide helpful, easy-to-understand " +
                            "follow-up guidance while being clear this isn't medical advice. How can I help?"))
            ));

            // Add conversation history
            for (ChatMessage msg : history) {
                contents.add(Map.of(
                        "role", msg.getRole(),
                        "parts", List.of(Map.of("text", msg.getContent()))
                ));
            }

            Map<String, Object> requestBody = Map.of(
                    "contents", contents,
                    "generationConfig", Map.of(
                            "temperature", 0.4,
                            "maxOutputTokens", 512,
                            "thinkingConfig", Map.of("thinkingBudget", 0)
                    )
            );

            String responseJson = geminiService.callGemini(requestBody);
            if (responseJson == null) {
                return "I'm having trouble connecting right now. Please try again in a moment.";
            }

            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode candidates = root.path("candidates");
            if (candidates.isEmpty()) {
                return "I wasn't able to generate a response. Please try rephrasing your question.";
            }

            String text = candidates.get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .stringValue();

            return text != null ? text : "I wasn't able to generate a response. Please try again.";
        } catch (Exception e) {
            log.warn("Chat Gemini call failed: {}", e.getMessage());
            return "Something went wrong. Please try again or consult your healthcare provider.";
        }
    }

    private String buildSystemContext(PatientSession session, SymptomAssessment assessment) {
        return """
                You are MedaPath's friendly AI health assistant having a follow-up conversation with a patient. \
                Here is their medical context:

                Patient: %s %s, Age %d
                Symptoms reported: %s
                Severity: %s | Duration: %s
                AI Diagnosis: %s
                Urgency: %s
                Care suggested: %s
                Advice given: %s
                Detailed explanation: %s

                RULES:
                - Be warm, conversational, and easy to understand — like a knowledgeable friend, NOT a textbook
                - Answer their follow-up questions using the context above
                - You can discuss medications, home remedies, what to expect, when to worry, etc.
                - ALWAYS remind them this is informational only and not a substitute for professional medical advice
                - Keep responses concise (2-4 sentences) unless they ask for detail
                - If they ask something outside your scope or dangerous, direct them to call 911 or see a doctor
                - NEVER diagnose new conditions — only discuss what was already analyzed
                - Use plain language, no medical jargon
                """.formatted(
                session.getFirstName(), session.getLastName(), session.getAge(),
                assessment.getSymptomText(),
                assessment.getSeverity(), assessment.getDuration(),
                assessment.getPrimaryCondition(),
                assessment.getUrgencyLevel(),
                assessment.getCareTypeSuggested(),
                assessment.getAdvice(),
                assessment.getDetailedExplanation() != null ? assessment.getDetailedExplanation() : "N/A"
        );
    }
}
