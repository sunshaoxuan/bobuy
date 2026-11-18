package com.bobbuy.service;

/** An actionable stale or invalid import confirmation, with no batch writes. */
public class CategoryImportConflict extends IllegalStateException {
  public CategoryImportConflict(String message) { super(message); }
}
