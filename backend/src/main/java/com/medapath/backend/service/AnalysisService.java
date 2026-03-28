package com.medapath.backend.service;

import com.medapath.backend.dto.AnalysisResponse;
import com.medapath.backend.dto.SymptomRequest;
import com.medapath.backend.model.SymptomAssessment;
import com.medapath.backend.repository.PatientSessionRepository;
import com.medapath.backend.repository.SymptomAssessmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalysisService {

    private final SymptomAssessmentRepository assessmentRepository;
    private final PatientSessionRepository sessionRepository;
    private final GeminiService geminiService;

    private static final Map<String, TriageResult> KEYWORD_TRIAGE = new LinkedHashMap<>();

    static {
        KEYWORD_TRIAGE.put("chest pain", new TriageResult(
                "Possible cardiac event",
                List.of("Angina", "Myocardial infarction", "Costochondritis"),
                "emergency", "emergency",
                "Seek emergency care immediately. Call 911 if pain is severe or accompanied by shortness of breath."
        ));
        KEYWORD_TRIAGE.put("difficulty breathing", new TriageResult(
                "Respiratory distress",
                List.of("Asthma exacerbation", "Pneumonia", "Anxiety-related hyperventilation"),
                "high", "emergency",
                "Seek immediate medical attention. If severe, call 911."
        ));
        KEYWORD_TRIAGE.put("fainting", new TriageResult(
                "Syncope episode",
                List.of("Vasovagal syncope", "Orthostatic hypotension", "Cardiac arrhythmia"),
                "high", "emergency",
                "Visit an emergency room for evaluation, especially if this is a first occurrence."
        ));
        KEYWORD_TRIAGE.put("severe headache", new TriageResult(
                "Severe cephalgia",
                List.of("Migraine", "Tension headache", "Possible intracranial issue"),
                "high", "urgent_care",
                "Seek urgent care. If sudden onset or 'worst headache of life,' go to the ER immediately."
        ));
        KEYWORD_TRIAGE.put("fever", new TriageResult(
                "Febrile illness",
                List.of("Viral infection", "Bacterial infection", "Inflammatory response"),
                "medium", "urgent_care",
                "Monitor temperature. Seek urgent care if fever exceeds 103F or persists more than 3 days."
        ));
        KEYWORD_TRIAGE.put("cough", new TriageResult(
                "Possible upper respiratory infection",
                List.of("Common cold", "Bronchitis", "Allergic rhinitis"),
                "medium", "primary_care",
                "Rest and hydrate. See a doctor if cough persists beyond 10 days or worsens."
        ));
        KEYWORD_TRIAGE.put("sore throat", new TriageResult(
                "Pharyngitis",
                List.of("Viral pharyngitis", "Streptococcal infection", "Tonsillitis"),
                "low", "primary_care",
                "Gargle with warm salt water, rest. See a doctor if symptoms persist beyond a week or include high fever."
        ));
        KEYWORD_TRIAGE.put("rash", new TriageResult(
                "Dermatological concern",
                List.of("Contact dermatitis", "Allergic reaction", "Eczema"),
                "low", "primary_care",
                "Avoid irritants. See a dermatologist or primary care if rash spreads or is accompanied by fever."
        ));
        KEYWORD_TRIAGE.put("stomach pain", new TriageResult(
                "Abdominal discomfort",
                List.of("Gastritis", "Irritable bowel syndrome", "Food intolerance"),
                "medium", "urgent_care",
                "Monitor symptoms. Seek care if pain is severe, persistent, or accompanied by vomiting blood."
        ));
        KEYWORD_TRIAGE.put("back pain", new TriageResult(
                "Musculoskeletal back pain",
                List.of("Muscle strain", "Herniated disc", "Sciatica"),
                "low", "primary_care",
                "Rest, apply ice/heat. See a doctor if pain radiates down legs or persists beyond 2 weeks."
        ));
        KEYWORD_TRIAGE.put("anxiety", new TriageResult(
                "Anxiety symptoms",
                List.of("Generalized anxiety", "Panic disorder", "Stress response"),
                "medium", "primary_care",
                "Practice deep breathing. Consider scheduling with a mental health professional."
        ));
        KEYWORD_TRIAGE.put("nausea", new TriageResult(
                "Nausea and possible GI disturbance",
                List.of("Gastroenteritis", "Food poisoning", "Motion sickness"),
                "low", "primary_care",
                "Stay hydrated with small sips. Seek care if vomiting persists beyond 24 hours or you cannot keep fluids down."
        ));
    }

    public AnalysisResponse analyze(SymptomRequest request, String imagePath) {
        sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new RuntimeException("Session not found: " + request.getSessionId()));

        // Try Gemini AI first, fall back to keyword triage
        TriageResult triage;
        String rawAiResponse;
        String imageNote = null;

        GeminiService.GeminiAnalysisResult geminiResult = geminiService.analyzeSymptoms(
                request.getSymptomText(), request.getSeverity(), request.getDuration(), imagePath);

        String detailedExplanation;

        if (geminiResult != null) {
            log.info("Using Gemini AI analysis for session {}", request.getSessionId());
            triage = new TriageResult(
                    geminiResult.primaryCondition(),
                    geminiResult.possibleConditions(),
                    geminiResult.urgencyLevel(),
                    geminiResult.careTypeSuggested(),
                    geminiResult.advice()
            );
            detailedExplanation = geminiResult.detailedExplanation();
            imageNote = geminiResult.imageNote();
            rawAiResponse = "gemini-" + geminiResult.toString();
        } else {
            log.info("Using fallback keyword triage for session {}", request.getSessionId());
            triage = triageFromKeywords(request.getSymptomText());
            triage = adjustForSeverity(triage, request.getSeverity());
            detailedExplanation = "Based on the symptoms you described, our system has identified a possible concern. " +
                    "We recommend seeing a healthcare provider who can give you a proper examination and confirm what's going on.";
            rawAiResponse = "fallback-triage-engine";
        }

        SymptomAssessment assessment = SymptomAssessment.builder()
                .sessionId(request.getSessionId())
                .symptomText(request.getSymptomText())
                .severity(request.getSeverity())
                .duration(request.getDuration())
                .imagePath(imagePath)
                .primaryCondition(triage.primaryCondition)
                .urgencyLevel(triage.urgencyLevel)
                .advice(triage.advice)
                .detailedExplanation(detailedExplanation)
                .careTypeSuggested(triage.careType)
                .rawAiResponse(rawAiResponse)
                .build();

        SymptomAssessment saved = assessmentRepository.save(assessment);

        return AnalysisResponse.builder()
                .assessmentId(saved.getId())
                .sessionId(saved.getSessionId())
                .primaryCondition(saved.getPrimaryCondition())
                .possibleConditions(triage.possibleConditions)
                .urgencyLevel(saved.getUrgencyLevel())
                .advice(saved.getAdvice())
                .detailedExplanation(saved.getDetailedExplanation())
                .careTypeSuggested(saved.getCareTypeSuggested())
                .imageAnalyzed(imagePath != null)
                .imageNote(imageNote)
                .build();
    }

    public AnalysisResponse getAnalysis(Long sessionId) {
        SymptomAssessment assessment = assessmentRepository.findTopBySessionIdOrderByCreatedAtDesc(sessionId);
        if (assessment == null) {
            throw new RuntimeException("No analysis found for session: " + sessionId);
        }

        TriageResult triage = triageFromKeywords(assessment.getSymptomText());

        return AnalysisResponse.builder()
                .assessmentId(assessment.getId())
                .sessionId(assessment.getSessionId())
                .primaryCondition(assessment.getPrimaryCondition())
                .possibleConditions(triage.possibleConditions)
                .urgencyLevel(assessment.getUrgencyLevel())
                .advice(assessment.getAdvice())
                .detailedExplanation(assessment.getDetailedExplanation())
                .careTypeSuggested(assessment.getCareTypeSuggested())
                .imageAnalyzed(assessment.getImagePath() != null)
                .build();
    }

    private TriageResult triageFromKeywords(String symptomText) {
        String lower = symptomText.toLowerCase();
        for (Map.Entry<String, TriageResult> entry : KEYWORD_TRIAGE.entrySet()) {
            if (lower.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return new TriageResult(
                "General health concern",
                List.of("Requires further evaluation"),
                "low", "primary_care",
                "Schedule an appointment with your primary care provider for a full evaluation."
        );
    }

    private TriageResult adjustForSeverity(TriageResult triage, String severity) {
        return switch (severity.toLowerCase()) {
            case "critical" -> new TriageResult(
                    triage.primaryCondition, triage.possibleConditions,
                    "emergency", "emergency", triage.advice
            );
            case "severe" -> new TriageResult(
                    triage.primaryCondition, triage.possibleConditions,
                    upgradeUrgency(triage.urgencyLevel), upgradeCareType(triage.careType), triage.advice
            );
            default -> triage;
        };
    }

    private String upgradeUrgency(String current) {
        return switch (current) {
            case "low" -> "medium";
            case "medium" -> "high";
            case "high" -> "emergency";
            default -> current;
        };
    }

    private String upgradeCareType(String current) {
        return switch (current) {
            case "primary_care" -> "urgent_care";
            case "urgent_care" -> "emergency";
            default -> current;
        };
    }

    record TriageResult(
            String primaryCondition,
            List<String> possibleConditions,
            String urgencyLevel,
            String careType,
            String advice
    ) {}
}
