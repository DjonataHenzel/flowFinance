package com.flowfinance.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FlowFinanceApplication {

    public static void main(String[] args) {
        SpringApplication.run(FlowFinanceApplication.class, args);
    }
}
