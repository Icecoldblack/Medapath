package com.medapath.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

@Configuration
@PropertySource(value = {"file:.env", "file:../.env", "file:backend/.env"}, ignoreResourceNotFound = true)
public class EnvConfig {
}
