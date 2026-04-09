FUNCTION zfm_iyh1hc2.
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     REFERENCE(IV_EBELN) TYPE  EBELN
*"  EXPORTING
*"     REFERENCE(EV_NETPR) TYPE  BPREI
*"----------------------------------------------------------------------

  TYPES: BEGIN OF lty_po,
           ebeln TYPE ebeln,
           ebelp TYPE ebelp,
           netpr TYPE bprei,
         END OF lty_po.

  DATA: lv_netpr TYPE bprei,
        ls_po    TYPE lty_po,
        lt_po    TYPE STANDARD TABLE OF lty_po,
        lt_matnr TYPE ZTT_PO_A_MATNR.

  SELECT a~ebeln b~ebelp b~netpr
    FROM ekko AS a
    INNER JOIN ekpo AS b ON b~ebeln = a~ebeln
    INTO TABLE lt_po
  WHERE a~ebeln = iv_ebeln
    AND a~bstyp = gv_bstyp.
  IF sy-subrc IS INITIAL.
    LOOP AT lt_po INTO ls_po.
      lv_netpr = lv_netpr + ls_po-netpr.
    ENDLOOP.
  ENDIF.

  IF lv_netpr > 10000.
    ev_netpr = 10000.
  ELSE.
    ev_netpr = lv_netpr.
  ENDIF.

ENDFUNCTION.