package com.medapath.backend.controller;

import com.medapath.backend.dto.HospitalMatchResponse;
import com.medapath.backend.service.HospitalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HospitalController {

    private final HospitalService hospitalService;

    @GetMapping("/hospitals/match")
    public ResponseEntity<HospitalMatchResponse> matchHospitals(@RequestParam Long sessionId) {
        HospitalMatchResponse response = hospitalService.matchHospitals(sessionId);
        return ResponseEntity.ok(response);
    }
}
