package com.medapath.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "hospitals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Hospital {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false, length = 1000)
    private String acceptedPlans;

    @Column(nullable = false)
    private String careTypes;

    private String phone;

    private String website;

    private String type;

    private Double rating;

    private String estimatedWaitTime;
}
