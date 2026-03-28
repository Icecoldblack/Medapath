package com.medapath.backend.repository;

import com.medapath.backend.model.PatientSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PatientSessionRepository extends JpaRepository<PatientSession, Long> {
}
