package com.bobbuy.model;

import java.util.HashMap;
import java.util.Map;

public class MediaGalleryItem {
    @Override public boolean equals(Object other) {
        if(this==other)return true;
        if(!(other instanceof MediaGalleryItem value))return false;
        return visible==value.visible&&java.util.Objects.equals(sha256,value.sha256)&&java.util.Objects.equals(url,value.url)&&type==value.type&&java.util.Objects.equals(sourceUrl,value.sourceUrl)&&java.util.Objects.equals(sourceDomain,value.sourceDomain)&&java.util.Objects.equals(sourceType,value.sourceType)&&java.util.Objects.equals(title,value.title);
    }
    @Override public int hashCode(){return java.util.Objects.hash(sha256,url,type,visible,sourceUrl,sourceDomain,sourceType,title);}
    // Preserve legacy optional image hashes without enabling inventory mutations.
    private String sha256;
    public String getSha256() { return sha256; }
    public void setSha256(String value) { sha256 = value; }
    private String url;
    private MediaType type;
    private boolean visible = true;
    private String sourceUrl;
    private String sourceDomain;
    private String sourceType;

    @JsonbColumn
    private Map<String, String> title = new HashMap<>();

    public MediaGalleryItem() {
    }

    public MediaGalleryItem(String url, MediaType type, Map<String, String> title) {
        this.url = url;
        this.type = type;
        this.title = title;
    }

    public MediaGalleryItem(String url, MediaType type, Map<String, String> title, boolean visible) {
        this.url = url;
        this.type = type;
        this.title = title;
        this.visible = visible;
    }

    public MediaGalleryItem(String url,
                            MediaType type,
                            Map<String, String> title,
                            boolean visible,
                            String sourceUrl,
                            String sourceDomain,
                            String sourceType) {
        this.url = url;
        this.type = type;
        this.title = title;
        this.visible = visible;
        this.sourceUrl = sourceUrl;
        this.sourceDomain = sourceDomain;
        this.sourceType = sourceType;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public MediaType getType() {
        return type;
    }

    public void setType(MediaType type) {
        this.type = type;
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
    }

    public Map<String, String> getTitle() {
        return title;
    }

    public void setTitle(Map<String, String> title) {
        this.title = title;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getSourceDomain() {
        return sourceDomain;
    }

    public void setSourceDomain(String sourceDomain) {
        this.sourceDomain = sourceDomain;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }
}
