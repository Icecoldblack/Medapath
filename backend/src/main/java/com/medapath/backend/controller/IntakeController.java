package com.medapath.backend.controller;

import com.medapath.backend.dto.IntakeRequest;
import com.medapath.backend.dto.IntakeResponse;
import com.medapath.backend.service.IntakeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class IntakeController {

    private final IntakeService intakeService;

    @PostMapping("/intake")
    public ResponseEntity<IntakeResponse> createSession(@Valid @RequestBody IntakeRequest request) {
        IntakeResponse response = intakeService.createSession(request);
        return ResponseEntity.ok(response);
    }
}
