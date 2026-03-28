package com.medapath.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "symptom_assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SymptomAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long sessionId;

    @Column(nullable = false, length = 1000)
    private String symptomText;

    @Column(nullable = false)
    private String severity;

    @Column(nullable = false)
    private String duration;

    private String imagePath;

    private String primaryCondition;

    private String urgencyLevel;

    @Column(length = 2000)
    private String advice;

    @Column(length = 3000)
    private String detailedExplanation;

    private String careTypeSuggested;

    @Column(length = 5000)
    private String rawAiResponse;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
