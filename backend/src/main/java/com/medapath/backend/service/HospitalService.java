package com.medapath.backend.service;

import com.medapath.backend.dto.HospitalDto;
import com.medapath.backend.dto.HospitalMatchResponse;
import com.medapath.backend.model.Hospital;
import com.medapath.backend.model.PatientSession;
import com.medapath.backend.model.SymptomAssessment;
import com.medapath.backend.repository.HospitalRepository;
import com.medapath.backend.repository.SymptomAssessmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HospitalService {

    private static final double NEARBY_THRESHOLD_MILES = 25.0;

    private final HospitalRepository hospitalRepository;
    private final SymptomAssessmentRepository assessmentRepository;
    private final IntakeService intakeService;
    private final GeminiService geminiService;
    private final PlacesService placesService;

    public HospitalMatchResponse matchHospitals(Long sessionId) {
        PatientSession session = intakeService.getSession(sessionId);
        SymptomAssessment assessment = assessmentRepository.findTopBySessionIdOrderByCreatedAtDesc(sessionId);

        if (assessment == null) {
            throw new RuntimeException("No analysis found for session: " + sessionId);
        }

        String insuranceProvider = session.getInsuranceProvider();
        String planName = session.getPlanName();
        String careType = assessment.getCareTypeSuggested();
        String urgency = assessment.getUrgencyLevel();
        String condition = assessment.getPrimaryCondition();
        double patientLat = session.getLatitude() != null ? session.getLatitude() : 0;
        double patientLon = session.getLongitude() != null ? session.getLongitude() : 0;
        boolean hasLocation = patientLat != 0 || patientLon != 0;

        List<HospitalDto> ranked;

        if (hasLocation) {
            // Score DB hospitals and check if any are close to the patient's ZIP
            List<Hospital> allHospitals = hospitalRepository.findAll();
            List<HospitalDto> dbResults = allHospitals.stream()
                    .map(h -> scoreHospital(h, insuranceProvider, planName, careType, urgency, patientLat, patientLon, true))
                    .sorted(Comparator.comparingInt(HospitalDto::getMatchScore).reversed())
                    .collect(Collectors.toList());

            // Check if the closest DB hospital is within threshold
            double closestDbMiles = dbResults.stream()
                    .filter(h -> h.getDistanceMiles() >= 0)
                    .mapToDouble(HospitalDto::getDistanceMiles)
                    .min()
                    .orElse(Double.MAX_VALUE);

            if (closestDbMiles > NEARBY_THRESHOLD_MILES && placesService.isAvailable()) {
                // Patient is far from seed data — use Google Places API
                log.info("Patient at ({}, {}) is {}mi from nearest DB hospital, using Places API",
                        patientLat, patientLon, String.format("%.1f", closestDbMiles));
                List<HospitalDto> placesResults = placesService.findNearbyHospitals(
                        patientLat, patientLon, 16000, 10); // ~10 mile radius

                if (!placesResults.isEmpty()) {
                    // Score the Places results for care type / urgency
                    for (HospitalDto h : placesResults) {
                        int score = 5; // base score for proximity
                        List<String> reasons = new ArrayList<>();
                        reasons.add(h.getDistance() + " away");

                        if ("emergency".equals(urgency) || "high".equals(urgency)) {
                            score += 15;
                            reasons.add("Urgency: seek immediate care");
                        }
                        h.setMatchScore(score);
                        h.setMatchReason(String.join("; ", reasons));
                    }

                    ranked = placesResults.stream()
                            .sorted(Comparator.comparingDouble(HospitalDto::getDistanceMiles))
                            .limit(5)
                            .collect(Collectors.toList());
                } else {
                    // Places API returned nothing — fall back to DB hospitals sorted by distance
                    log.info("Places API returned no results, falling back to DB hospitals");
                    ranked = dbResults.stream().limit(5).collect(Collectors.toList());
                }
            } else {
                ranked = dbResults.stream().limit(5).collect(Collectors.toList());
            }
        } else {
            // No location — just return top DB hospitals without distance
            List<Hospital> allHospitals = hospitalRepository.findAll();
            ranked = allHospitals.stream()
                    .map(h -> scoreHospital(h, insuranceProvider, planName, careType, urgency, 0, 0, false))
                    .sorted(Comparator.comparingInt(HospitalDto::getMatchScore).reversed())
                    .limit(5)
                    .collect(Collectors.toList());
        }

        // Use Gemini to add coverage analysis for top hospitals
        enrichWithCoverageNotes(ranked, insuranceProvider, planName, condition, urgency);

        return HospitalMatchResponse.builder()
                .sessionId(sessionId)
                .diagnosis(assessment.getPrimaryCondition())
                .urgencyLevel(assessment.getUrgencyLevel())
                .patientLatitude(hasLocation ? patientLat : null)
                .patientLongitude(hasLocation ? patientLon : null)
                .hospitals(ranked)
                .build();
    }

    private void enrichWithCoverageNotes(List<HospitalDto> hospitals, String insuranceProvider,
                                          String planName, String condition, String urgency) {
        if (!geminiService.isAvailable() || hospitals.isEmpty()) return;

        try {
            StringBuilder hospitalList = new StringBuilder();
            for (int i = 0; i < hospitals.size(); i++) {
                HospitalDto h = hospitals.get(i);
                hospitalList.append(String.format("%d. %s (%s) - %s - In-Network: %s\n",
                        i + 1, h.getName(), h.getType(),
                        h.getDistance(), h.isInNetwork() ? "Yes" : "No"));
            }

            String prompt = """
                    You are a healthcare insurance advisor. A patient has %s (urgency: %s). \
                    Their insurance is %s, plan: %s.

                    Here are their matched hospitals:
                    %s

                    For EACH hospital (numbered 1-%d), write ONE short sentence (max 20 words) about \
                    whether their plan would likely cover treatment there for this condition. \
                    Be practical and helpful, not legal.

                    Respond ONLY with valid JSON, no markdown:
                    {"notes": ["note for hospital 1", "note for hospital 2", ...]}
                    """.formatted(condition, urgency, insuranceProvider,
                    planName != null ? planName : "unknown",
                    hospitalList.toString(), hospitals.size());

            var requestBody = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", 512, "thinkingConfig", Map.of("thinkingBudget", 0))
            );

            String responseJson = geminiService.callGemini(requestBody);
            if (responseJson != null) {
                var objectMapper = new tools.jackson.databind.ObjectMapper();
                var root = objectMapper.readTree(responseJson);
                var text = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").stringValue();
                if (text != null) {
                    text = text.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
                    var notesRoot = objectMapper.readTree(text);
                    var notesArray = notesRoot.path("notes");
                    if (notesArray.isArray()) {
                        for (int i = 0; i < Math.min(notesArray.size(), hospitals.size()); i++) {
                            hospitals.get(i).setCoverageNote(notesArray.get(i).stringValue());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to enrich hospitals with coverage notes: {}", e.getMessage());
        }
    }

    private HospitalDto scoreHospital(Hospital hospital, String insuranceProvider, String planName,
                                       String careType, String urgency, double patLat, double patLon,
                                       boolean hasLocation) {
        int score = 0;
        List<String> reasons = new ArrayList<>();

        // Insurance matching
        String plans = hospital.getAcceptedPlans().toLowerCase();
        boolean inNetwork = false;
        if (planName != null && !planName.isBlank() && plans.contains(planName.toLowerCase())) {
            score += 50;
            inNetwork = true;
            reasons.add("Exact plan match");
        } else if (insuranceProvider != null && plans.contains(insuranceProvider.toLowerCase())) {
            score += 30;
            inNetwork = true;
            reasons.add("In-network provider");
        }

        // Care type matching
        String hospitalCareTypes = hospital.getCareTypes().toLowerCase();
        if (careType != null && hospitalCareTypes.contains(careType)) {
            score += 30;
            reasons.add("Matches recommended care type");
        } else if (hospitalCareTypes.contains("emergency")) {
            score += 15;
            reasons.add("Emergency services available");
        }

        // Emergency override
        if (("emergency".equals(urgency) || "high".equals(urgency))
                && hospitalCareTypes.contains("emergency")) {
            score += 25;
            reasons.add("Emergency-capable facility");
        }

        // Distance scoring
        double distance;
        String distanceStr;
        if (hasLocation) {
            distance = calculateDistance(patLat, patLon, hospital.getLatitude(), hospital.getLongitude());
            distanceStr = String.format("%.1f mi", distance);
            if (distance < 3) {
                score += 20;
            } else if (distance < 8) {
                score += 10;
            } else {
                score += 5;
            }
            reasons.add(distanceStr + " away");
        } else {
            distance = -1;
            distanceStr = "Distance unavailable";
        }

        return HospitalDto.builder()
                .id(hospital.getId())
                .name(hospital.getName())
                .address(hospital.getAddress())
                .latitude(hospital.getLatitude())
                .longitude(hospital.getLongitude())
                .type(hospital.getType())
                .inNetwork(inNetwork)
                .distance(distanceStr)
                .distanceMiles(distance)
                .rating(hospital.getRating())
                .estimatedWaitTime(hospital.getEstimatedWaitTime())
                .phone(hospital.getPhone())
                .website(hospital.getWebsite())
                .matchReason(String.join("; ", reasons))
                .matchScore(score)
                .build();
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusMiles = 3958.8;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusMiles * c;
    }
}
