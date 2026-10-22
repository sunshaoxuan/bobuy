package com.bobbuy.model;

import jakarta.persistence.*;

/** A shared allocation sequence keeps registered customers and checkout orders away from legacy seed IDs. */
@Entity
@Table(name = "bb_checkout_identity")
public class CheckoutIdentity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "checkout_ids")
    @SequenceGenerator(name = "checkout_ids", sequenceName = "bb_checkout_ids", initialValue = 1000000, allocationSize = 1)
    public Long id;
}
