package com.medapath.backend.service;

import com.medapath.backend.dto.HospitalDto;
import com.medapath.backend.dto.HospitalMatchResponse;
import com.medapath.backend.model.Hospital;
import com.medapath.backend.model.PatientSession;
import com.medapath.backend.model.SymptomAssessment;
import com.medapath.backend.repository.HospitalRepository;
import com.medapath.backend.repository.SymptomAssessmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HospitalService {

    private final HospitalRepository hospitalRepository;
    private final SymptomAssessmentRepository assessmentRepository;
    private final IntakeService intakeService;

    public HospitalMatchResponse matchHospitals(Long sessionId) {
        PatientSession session = intakeService.getSession(sessionId);
        SymptomAssessment assessment = assessmentRepository.findTopBySessionIdOrderByCreatedAtDesc(sessionId);

        if (assessment == null) {
            throw new RuntimeException("No analysis found for session: " + sessionId);
        }

        List<Hospital> allHospitals = hospitalRepository.findAll();
        String insuranceProvider = session.getInsuranceProvider();
        String planName = session.getPlanName();
        String careType = assessment.getCareTypeSuggested();
        String urgency = assessment.getUrgencyLevel();
        double patientLat = session.getLatitude() != null ? session.getLatitude() : 0;
        double patientLon = session.getLongitude() != null ? session.getLongitude() : 0;

        List<HospitalDto> ranked = allHospitals.stream()
                .map(h -> scoreHospital(h, insuranceProvider, planName, careType, urgency, patientLat, patientLon))
                .sorted(Comparator.comparingInt(HospitalDto::getMatchScore).reversed())
                .limit(5)
                .collect(Collectors.toList());

        return HospitalMatchResponse.builder()
                .sessionId(sessionId)
                .diagnosis(assessment.getPrimaryCondition())
                .urgencyLevel(assessment.getUrgencyLevel())
                .hospitals(ranked)
                .build();
    }

    private HospitalDto scoreHospital(Hospital hospital, String insuranceProvider, String planName,
                                       String careType, String urgency, double patLat, double patLon) {
        int score = 0;
        List<String> reasons = new ArrayList<>();

        // Insurance matching
        String plans = hospital.getAcceptedPlans().toLowerCase();
        boolean inNetwork = false;
        if (planName != null && plans.contains(planName.toLowerCase())) {
            score += 50;
            inNetwork = true;
            reasons.add("Exact plan match");
        } else if (plans.contains(insuranceProvider.toLowerCase())) {
            score += 30;
            inNetwork = true;
            reasons.add("In-network provider");
        }

        // Care type matching
        String hospitalCareTypes = hospital.getCareTypes().toLowerCase();
        if (hospitalCareTypes.contains(careType)) {
            score += 30;
            reasons.add("Matches recommended care type");
        } else if (hospitalCareTypes.contains("emergency")) {
            score += 15;
            reasons.add("Emergency services available");
        }

        // Emergency override: boost emergency-capable hospitals when urgency is high
        if (("emergency".equals(urgency) || "high".equals(urgency))
                && hospitalCareTypes.contains("emergency")) {
            score += 25;
            reasons.add("Emergency-capable facility");
        }

        // Distance scoring
        double distance = calculateDistance(patLat, patLon, hospital.getLatitude(), hospital.getLongitude());
        if (distance < 3) {
            score += 20;
        } else if (distance < 8) {
            score += 10;
        } else {
            score += 5;
        }

        String distanceStr = String.format("%.1f mi", distance);
        if (distance > 0 && distance < 100) {
            reasons.add(distanceStr + " away");
        }

        return HospitalDto.builder()
                .id(hospital.getId())
                .name(hospital.getName())
                .address(hospital.getAddress())
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
        if (lat1 == 0 && lon1 == 0) return 999;
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
