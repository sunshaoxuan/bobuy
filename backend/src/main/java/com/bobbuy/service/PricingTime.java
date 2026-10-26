package com.bobbuy.service;
import java.time.Instant;
import org.springframework.stereotype.Component;
@Component public class PricingTime { public Instant now(){return Instant.now();} }
