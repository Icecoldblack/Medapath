package com.medapath.backend.service;

import com.medapath.backend.dto.IntakeRequest;
import com.medapath.backend.dto.IntakeResponse;
import com.medapath.backend.model.PatientSession;
import com.medapath.backend.repository.PatientSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class IntakeService {

    private final PatientSessionRepository patientSessionRepository;

    public IntakeResponse createSession(IntakeRequest request) {
        PatientSession session = PatientSession.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .age(request.getAge())
                .zipCode(request.getZipCode())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .insuranceProvider(request.getInsuranceProvider())
                .planName(request.getPlanName())
                .build();

        PatientSession saved = patientSessionRepository.save(session);

        return IntakeResponse.builder()
                .sessionId(saved.getId())
                .firstName(saved.getFirstName())
                .lastName(saved.getLastName())
                .message("Patient session created successfully")
                .build();
    }

    public PatientSession getSession(Long sessionId) {
        return patientSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));
    }
}
