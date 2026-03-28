package com.medapath.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IntakeResponse {

    private Long sessionId;
    private String firstName;
    private String lastName;
    private String message;
}
