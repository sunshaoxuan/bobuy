package com.bobbuy.service;

import com.bobbuy.model.OrderLine;
import com.bobbuy.model.Product;

/** Capture only when creating an order line; never refresh historical orders from a master. */
public final class OrderProductSnapshot {
    private OrderProductSnapshot() {}
    public static void capture(OrderLine line, Product product) {
        line.setNames(product.getName());
        line.setBrand(product.getBrand());
        line.setItemNumber(product.getItemNumber());
        line.setSaleUnit(line.getSpec());
        var catalog=product.getCatalogData();
        if(catalog!=null){
            line.setSpecifications(catalog.specification());
            line.setModel(catalog.model());
            line.setPackaging(catalog.packaging());
        }
    }
}
