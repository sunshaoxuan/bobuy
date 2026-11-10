package com.bobbuy.service;

import com.bobbuy.api.StorefrontController;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StorefrontTripVisibilityTest {
    private final TripRepository trips = mock(TripRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ProductRepository products = mock(ProductRepository.class);
    private final ProductSaleService sales = mock(ProductSaleService.class);
    private final StorefrontService service = new StorefrontService(users,trips,products,null,null,null,null,null,null,null,"test@example.invalid",sales,null);

    private Trip trip(long id, TripStatus status, int days) {
        return new Trip(id,1L,"Synthetic destination",LocalDate.now().plusDays(days),status,LocalDateTime.now());
    }

    @Test void upcomingAndTodayRemainVisibleIndependentOfProductAvailability() {
        when(trips.findAll()).thenReturn(List.of(trip(1,TripStatus.PUBLISHED,1),trip(2,TripStatus.PUBLISHED,0),trip(3,TripStatus.PUBLISHED,-1)));
        // No stock/capacity or sellable-product lookup: a sold-out upcoming trip stays visible.
        assertThat(service.publicTrips()).extracting(StorefrontService.PublicTrip::id).containsExactly(2L,1L);
        assertThat(service.publicTrips(true)).extracting(StorefrontService.PublicTrip::id).containsExactly(2L,1L);
        verifyNoInteractions(products,sales);
    }

    @Test void inProgressStaysCurrentUntilItsActualStatusChangesEvenAfterDeliveryDate() {
        when(trips.findAll()).thenReturn(List.of(trip(1,TripStatus.IN_PROGRESS,-2),trip(2,TripStatus.COMPLETED,1),trip(3,TripStatus.SETTLED,1)));
        assertThat(service.publicTrips()).isEmpty();
        assertThat(service.publicTrips(true)).extracting(StorefrontService.PublicTrip::id).containsExactly(1L);
        verifyNoInteractions(products,sales);
    }

    @Test void ordinaryPublicQueryRemainsBookableOnlyAndDisplayOptInDoesNotBroadenFields() throws Exception {
        when(trips.findAll()).thenReturn(List.of(trip(1,TripStatus.IN_PROGRESS,-2)));
        var mvc=MockMvcBuilders.standaloneSetup(new StorefrontController(service,null,null)).build();
        mvc.perform(get("/api/storefront/trips")).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/storefront/trips").param("includeCurrent","true"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(1))
            .andExpect(jsonPath("$.data[0].merchantId").value(1))
            .andExpect(jsonPath("$.data[0].currentWeight").doesNotExist())
            .andExpect(jsonPath("$.data[0].orders").doesNotExist());
    }
}
