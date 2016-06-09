package uk.gov.digital.ho.proving.income.family.cwtool;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;

import static org.springframework.boot.SpringApplication.run;

@SpringBootApplication
public class ServiceRunner  {

    private static Logger LOGGER = LoggerFactory.getLogger(ServiceRunner.class);

    //@Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder application) {
        return application.sources(ServiceRunner.class);
    }

    public static void main(String[] args) throws Exception {

        String remotePort = System.getProperty("remote.server.port", "8081");

        String url = "http://localhost:"+ remotePort;

        LOGGER.info("Remote url: " + url);

        run(ServiceRunner.class, args);
    }

}
