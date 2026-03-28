package com.medapath.backend.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IntakeRequest {

    @NotBlank(message = "First name is required")
    private String firstName;

    @NotBlank(message = "Last name is required")
    private String lastName;

    @NotNull(message = "Age is required")
    @Min(value = 0, message = "Age must be non-negative")
    @Max(value = 150, message = "Age must be realistic")
    private Integer age;

    @NotBlank(message = "ZIP code is required")
    private String zipCode;

    private Double latitude;

    private Double longitude;

    @NotBlank(message = "Insurance provider is required")
    private String insuranceProvider;

    private String planName;
}
