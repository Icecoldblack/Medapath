package com.medapath.backend.controller;

import com.medapath.backend.dto.AnalysisResponse;
import com.medapath.backend.dto.SymptomRequest;
import com.medapath.backend.service.AnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;

    private static final String UPLOAD_DIR = "uploads/";
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "video/mp4", "video/quicktime", "video/webm"
    );

    @PostMapping("/analyze")
    public ResponseEntity<AnalysisResponse> analyze(
            @Valid @RequestPart("data") SymptomRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) throws IOException {

        String imagePath = null;
        if (image != null && !image.isEmpty()) {
            String contentType = image.getContentType();
            if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
                return ResponseEntity.badRequest().build();
            }
            imagePath = saveImage(image);
        }

        AnalysisResponse response = analysisService.analyze(request, imagePath);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/analyze/json")
    public ResponseEntity<AnalysisResponse> analyzeJson(@Valid @RequestBody SymptomRequest request) {
        AnalysisResponse response = analysisService.analyze(request, null);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/analysis/{sessionId}")
    public ResponseEntity<AnalysisResponse> getAnalysis(@PathVariable Long sessionId) {
        AnalysisResponse response = analysisService.getAnalysis(sessionId);
        return ResponseEntity.ok(response);
    }

    private String saveImage(MultipartFile image) throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR).toAbsolutePath();
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        String filename = UUID.randomUUID() + "_" + image.getOriginalFilename();
        Path filePath = uploadPath.resolve(filename);
        Files.copy(image.getInputStream(), filePath);
        return filePath.toAbsolutePath().toString();
    }
}
