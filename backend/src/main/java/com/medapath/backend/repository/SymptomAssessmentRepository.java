package com.medapath.backend.repository;

import com.medapath.backend.model.SymptomAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SymptomAssessmentRepository extends JpaRepository<SymptomAssessment, Long> {

    List<SymptomAssessment> findBySessionId(Long sessionId);

    SymptomAssessment findTopBySessionIdOrderByCreatedAtDesc(Long sessionId);
}
