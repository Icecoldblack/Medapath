package com.medapath.backend.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@Slf4j
public class GeocodingService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;

    public GeocodingService(@Value("${google.api.key:}") String apiKey) {
        this.apiKey = apiKey;
        this.objectMapper = new ObjectMapper();
        this.restClient = RestClient.builder()
                .baseUrl("https://maps.googleapis.com/maps/api")
                .build();
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    public double[] geocodeZip(String zipCode) {
        if (!isAvailable()) {
            log.info("Google API key not configured, skipping geocoding");
            return null;
        }

        try {
            String responseJson = restClient.get()
                    .uri("/geocode/json?address={zip}&key={key}", zipCode, apiKey)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode results = root.path("results");

            if (results.isEmpty() || !results.isArray() || results.size() == 0) {
                log.warn("No geocoding results for ZIP: {}", zipCode);
                return null;
            }

            JsonNode location = results.get(0).path("geometry").path("location");
            double lat = location.path("lat").asDouble();
            double lng = location.path("lng").asDouble();

            log.info("Geocoded ZIP {} to ({}, {})", zipCode, lat, lng);
            return new double[]{lat, lng};
        } catch (Exception e) {
            log.warn("Geocoding failed for ZIP {}: {}", zipCode, e.getMessage());
            return null;
        }
    }
}
