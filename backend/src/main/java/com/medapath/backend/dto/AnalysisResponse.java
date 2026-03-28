package com.medapath.backend.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalysisResponse {

    private Long assessmentId;
    private Long sessionId;
    private String primaryCondition;
    private List<String> possibleConditions;
    private String urgencyLevel;
    private String advice;
    private String detailedExplanation;
    private String careTypeSuggested;
    private boolean imageAnalyzed;
    private String imageNote;
}
