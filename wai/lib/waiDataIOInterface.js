// [ Y[wai] Data I/O Service Object ]
//
//
// Apr 2023 : Developement by Hyunwoo,Hwang / Prototype 1.0.0

(function(){
    if ((waiDataIO == undefined)||(waiDataIO == null)) {
        console.error('waiDataIOInterface : Required pre-loaded "waiDataIO.js" file');
        return null;
    }

    var DefEventFunction = {
        "SVCBEFCALL"  : "function %FUNCNAME%(svcId,inpData,svcObj) {\n"+
                        "   switch (svcId) {\n"+
                        "       case ('service1') : {\n"+
                        "       \n"+
                        "       }\n"+
                        "       break;\n"+
                        "       case ('service2') : {\n"+
                        "       \n"+
                        "       }\n"+
                        "       break;\n"+
                        "   }\n"+
                        "}\n",
        "SVCAFTCALL"  : "function %FUNCNAME%(svcId,inpData,outData,svcObj) {\n"+
                        "   switch (svcId) {\n"+
                        "       case ('service1') : {\n"+
                        "       \n"+
                        "       }\n"+
                        "       break;\n"+
                        "       case ('service2') : {\n"+
                        "       \n"+
                        "       }\n"+
                        "       break;\n"+
                        "   }\n"+
                        "}\n",
        "SVCERRCALL"  : "function %FUNCNAME%(svcId,isServerError,errMsg,errCode,svcObj) {\n"+
                        "   switch (svcId) {\n"+
                        "       case ('service1') : {\n"+
                        "       \n"+
                        "       }\n"+
                        "       break;\n"+
                        "       case ('service2') : {\n"+
                        "       \n"+
                        "       }\n"+
                        "       break;\n"+
                        "   }\n"+
                        "}\n"
    }



    // Interface for Y[wai] HTML Designer
    var _waiDataIO_Interface = function(argWindow) {
        var self = this;
        var init = false;
        var wnd  = null;
        var doc  = null;

        this.init = function(tarWindow) {
            wnd  = tarWindow;
            doc  = wnd.document;
            init = true;
        };
        self.init(argWindow);

        function initCheck() {
            if (!init) {
                console.error('waiDataIO Interface object not inited.');
            }
            return init;
        };

        function parseWebPath(strPath) {
            var rt = {
                'orgPath' : strPath,
                'isRel'   : true,
                'host'    : '',
                'port'    : '80',
                'file'    : '',
                'ext'     : '',
                'filePre' : ''
            };

            var str = (strPath+'');
            var lpi = str.lastIndexOf('/');
            var lei = str.lastIndexOf('.');

            rt.ext  = (lei < 0) ? '' : str.substring(lei+1);
            rt.file = (lpi < 0) ? '' : str.substring(lpi+1);
            rt.filePre = (lei < 0) ? rt.file : str.substring(lpi+1,lei);

            var tmp,host;
            if ((str[0] == '/')||(str[0] == '.')) {
                rt.isRel = true;    // 간접 주소
                var tmp = str.substring(str.indexOf('/')+1);
                host = wnd.location.host;
            } else {
                rt.isRel = false;   // 직접 주소
                var tmp  = str.substring(str.indexOf('://')+3);
                var fpi = tmp.indexOf('/');
                var host = (fpi < 0 ) ? tmp : tmp.substring(0,fpi);
            }

            var fpp = host.indexOf(':');
            if (fpp < 0) {
                rt.host = host;
                rt.port = (rt.isRel) ? wnd.location.port : '80';
            } else {
                rt.host = host.substring(0,fpp);
                rt.port = host.substring(fpp+1);
            }

            return rt;
        }

        this.alreadySvcID = function(newID) {
            return ($('#'+newID).length > 0);
        };

        this.genNewServiceID = function(filePre) {
            var newID = filePre;
            var cnt = 0;
            while ($('#'+newID).length > 0) {
                cnt++;
                newID = filePre+'_'+cnt;
            }
            return newID;
        }

        function jsonAttrToStr(jAttr) {
            var rt = '';
            for (var x in jAttr) {
                rt+=' '+x+'="'+jAttr[x]+'"';
            }
            return rt;
        }

        function createServiceElem(newId,pPath,svcOpt) {
            var sp = '    ';
            var rt = null;
            var defOpt = {
                'autocall'  : false
            };

            if (svcOpt != undefined) {
                for (var x in defOpt) {
                    defOpt[x] = (svcOpt[x] != undefined) ? svcOpt[x] : defOpt[x];
                }
            }

            var dioElem = $('dataio');
            if (dioElem.length == 0) {
                var evtTexts = '';
                try {
                    var defevts = waiDataIO.defaultServiceOpts.events;
                    for (var x in defevts) {
                        evtTexts += sp+sp+'<'+x+' onevent=""><!-- '+defevts[x].defElemCmt+' --></'+x+'>\n';
                    }
                    //console.log(evtTexts);
                } catch(e) {
                    console.error('can not loaded default events configuration at "waiDataSettings.json" file.',e);
                    evtTexts = '';
                    // sp+sp+'<onbeforecall onevent=""><!-- Fire event before service call --></onbeforecall>\n'+
                    // sp+sp+'<onaftercall onevent=""><!-- Fire event after service call --></onaftercall>\n'+
                    // sp+sp+'<oncallerror onevent=""><!-- Fire event when a service call error occurs --></oncallerror>\n';
                }
    
                var dataioTxt = ''+
                    '<dataio>\n'+
                    sp+'<events>\n'+
                    evtTexts+
                    sp+'</events>\n'+
                    '</dataio>\n';
                $('body').prepend(dataioTxt);
                dioElem = $('dataio');
            }

            if (dioElem.length > 0) {
                rt = dioElem.append(sp+'<service id="'+newId+'" map="'+pPath.orgPath+'"'+jsonAttrToStr(defOpt)+'></service>\n');
            } else {
                console.error('can not create <dataio> element');
            }
            
            return rt;
        }


        this.service = {
            'create' : function(svcWebPath,sOpt,callback) {
                var pwp = parseWebPath(svcWebPath);
                var nid = ((sOpt['elemID'] == undefined)||(sOpt['elemID'] == '')||(sOpt['elemID'] == null)) ? self.genNewServiceID(pwp.filePre) : sOpt['elemID'];
                var nsv = createServiceElem(nid,pwp,sOpt);
                //console.log(pwp,nsv);

                var svc = $('#'+nid)[0];
                console.log(svc,{'id':svc.id,'map':svc.map});
                return waiDataIO.addNewService(svc,callback);
            },
            'delete' : function(elemId) {
                var svcs = waiDataIO.services;
                for (var i=svcs.length-1;i>=0;i--) {
                    if (svcs[i].elem.id == elemId) {
                        $(waiDataIO.services[i].elem).remove();
                        waiDataIO.services[i].free();
                        waiDataIO.services.splice(i,1);
                    }
                }
            },
            'deleteAll' : function() {
                var svcs = waiDataIO.services;
                for (var i=svcs.length-1;i>=0;i--) {
                    $(waiDataIO.services[i].elem).remove();
                    waiDataIO.services[i].free();
                }
                waiDataIO.services = [];    
            },
            'elemList' : function() {
                var rt = null;
                var dataio = $('dataio');
                if (dataio.length > 0) {
                    console.log ( dataio[0].innerHTML );
                    rt = $(dataio).children('service');
                    if (rt.length == 0) rt = null;
                }
                return rt;
            }
        };

        this.link = {
            'listBySvc' : function(elemID) {
                var rt = [];
                var elems = $("[datasrc^='"+elemID+".']");
                for (var i=0;i<elems.length;i++) {
                    rt.push(elems[i]);
                }
                return rt;
            },
            'setLink' : function(tarElem,datasrc,datafld) {
                $(tarElem).attr('datasrc',datasrc);    
                if (datafld != undefined) {
                    $(tarElem).attr('datafld',datafld);
                }
            }
        };
    };
    
    waiDataIO['interface'] = new _waiDataIO_Interface(window);
})();
