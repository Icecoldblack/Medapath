package com.medapath.backend.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SymptomRequest {

    @NotNull(message = "Session ID is required")
    private Long sessionId;

    @NotBlank(message = "Symptom description is required")
    @Size(max = 500, message = "Symptom description must be 500 characters or less")
    private String symptomText;

    @NotBlank(message = "Severity is required")
    private String severity;

    @NotBlank(message = "Duration is required")
    private String duration;
}
