package com.bobbuy.service;

import java.util.ArrayList;
import java.util.List;

/** Logical CSV records with strict quoting and lossless malformed-record reporting.
 * Recovery must retain the original record rather than silently repair a category name.
 */
final class CategoryPathCsvParser {
    private CategoryPathCsvParser() {}

    static List<String[]> parse(String text) {
        if(text.startsWith("\uFEFF")) text=text.substring(1);
        List<String[]> rows=new ArrayList<>();
        List<String> cells=new ArrayList<>();
        StringBuilder cell=new StringBuilder();
        boolean quoted=false, closed=false, invalid=false;
        int start=0;
        for(int i=0;i<text.length();i++) {
            char ch=text.charAt(i);
            if(quoted) {
                if(ch=='"') {
                    if(i+1<text.length() && text.charAt(i+1)=='"') {cell.append('"');i++;}
                    else {quoted=false;closed=true;}
                } else cell.append(ch);
            } else if(ch==',' || ch=='\n' || ch=='\r') {
                cells.add(cell.toString());cell.setLength(0);closed=false;
                if(ch!=',') {
                    add(rows,cells,text.substring(start,i),invalid);
                    cells.clear();invalid=false;
                    if(ch=='\r' && i+1<text.length() && text.charAt(i+1)=='\n') i++;
                    start=i+1;
                }
            } else if(ch=='"' && cell.isEmpty() && !closed) {
                quoted=true;
            } else {
                if(ch=='"' || closed) invalid=true;
                cell.append(ch);
            }
        }
        if(start<text.length()) {
            cells.add(cell.toString());
            add(rows,cells,text.substring(start),invalid||quoted);
        }
        return rows;
    }

    private static void add(List<String[]> rows,List<String> cells,String raw,boolean invalid) {
        if(invalid) {
            // The full raw logical record is retained in the unmatched breadcrumb column.
            rows.add(new String[]{cells.get(0),raw,"Malformed CSV quoting; correct the original record"});
        } else if(cells.size()!=2) {
            rows.add(new String[]{cells.get(0),raw,"Exactly two columns are required"});
        } else rows.add(new String[]{cells.get(0),cells.get(1)});
    }
}
