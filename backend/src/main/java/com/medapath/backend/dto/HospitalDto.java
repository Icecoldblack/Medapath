package com.medapath.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HospitalDto {

    private Long id;
    private String name;
    private String address;
    private Double latitude;
    private Double longitude;
    private String type;
    private boolean inNetwork;
    private String distance;
    private Double distanceMiles;
    private Double rating;
    private String estimatedWaitTime;
    private String phone;
    private String website;
    private String matchReason;
    private String coverageNote;
    private int matchScore;
}
