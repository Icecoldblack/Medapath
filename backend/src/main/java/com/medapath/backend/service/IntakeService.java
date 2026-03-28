package com.medapath.backend.service;

import com.medapath.backend.dto.IntakeRequest;
import com.medapath.backend.dto.IntakeResponse;
import com.medapath.backend.model.PatientSession;
import com.medapath.backend.repository.PatientSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class IntakeService {

    private final PatientSessionRepository patientSessionRepository;
    private final GeocodingService geocodingService;

    public IntakeResponse createSession(IntakeRequest request) {
        Double latitude = request.getLatitude();
        Double longitude = request.getLongitude();

        // If frontend didn't send coordinates, geocode from ZIP
        if ((latitude == null || longitude == null) && request.getZipCode() != null) {
            double[] coords = geocodingService.geocodeZip(request.getZipCode());
            if (coords != null) {
                latitude = coords[0];
                longitude = coords[1];
                log.info("Geocoded ZIP {} to ({}, {})", request.getZipCode(), latitude, longitude);
            }
        }

        PatientSession session = PatientSession.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .age(request.getAge())
                .zipCode(request.getZipCode())
                .latitude(latitude)
                .longitude(longitude)
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
