// [ Y[wai] Data I/O Service Object ]
//
//
// Apr 2023 : Developement by Hyunwoo,Hwang / Prototype 1.0.0

var waiDataIO = null;

(function(){
    //----------------------------------------------------------------------------------------- [ Data Service Object ]
    const defSvcOptFile = 'waiDataSettings.json';
    const defDataProcMd = 'waiDataProcModules.json';

    var _dataServiceObj = function(dioObj, tarElem, svcOpts, idx, callback) {
        const  self = this;
        const  wdio = dioObj;
        var    elem = tarElem;
        var  inited = false;
        var   index = idx;
        var   props = {
            //-------------------------
            'map'         : '',
            'autocall'    : 'false',
            //-------------------------
            'timeout'     : 3000,
            'serviceUrl'  : '',
            'moduleExec'  : true,
            'autoGather'  : true,
            'autoUpdate'  : true,            
            //-------------------------
            'consoleLogs' : {
                "create"   : false,
                "call"     : false,
                "sendData" : false,
                "recvData" : false                
            },
            //------------------------- Map data props
            'mapJson'     : '',
            'info'        : {},
            'inputs'      : {},
            'outputs'     : {}
        };

        this.init = function() {
            var x;

            // 전역 기본 설정값 설정 // "waiDataSettings.json"
            if (svcOpts != undefined) {
                var sOpts = svcOpts['service'];
                if (sOpts != undefined) {
                    var cLogs = sOpts['consoleLogs'];
                    if (cLogs != undefined) {
                        for (x in props.consoleLogs) {
                            props.consoleLogs[x] = (cLogs[x] != undefined) ? cLogs[x] : props.consoleLogs[x];
                        }
                    }

                    var defOpt = sOpts['defOptions'];
                    if (defOpt != undefined) {
                        for (x in defOpt) {
                            if (props[x] != undefined) props[x] = defOpt[x];
                        }
                    }

                    props.serviceUrl = (sOpts['defCallService'] != undefined) ? sOpts['defCallService'] : '';
                }
            }

            // Attribute 를 최종적으로 적용해서 속성값 설정
            for (x in props) {
                var v = $(elem).attr(x);
                props[x] = (v != undefined) ? v : props[x];
            }

            if (props.map != '') {
                var reqMap = {
                    /* 맵 요청용 인풋 데이터가 필요할까 ? */                    
                };

                $.ajax({
                    type     : 'post',
                    url      : props['map'],
                    data     : reqMap,
                    dataType : 'json',
                    async    : false,
                    error    : mapLoadError,
                    success  : mapLoaded
                });
            }

            // assign methods
            var methods = {
                'call' : self.call
            };
            for (x in methods) {
                elem[x] = methods[x];
            }
        };

        this.free = function() {

        };

        function mapLoadError(xhr,sts,err) {
            console.error(xhr,sts,err);
        }
        function mapLoaded(data,sts,xhr) {
            console.log('success',data);
            self.loadMapProcess(data);
        }

        this.loadMapProcess = function(mapJson) {
            var inps = mapJson['inputs'];            
            var outs = mapJson['outputs'];

            var x,newDs;

            for (x in inps) {
                //console.log(x);
                props.inputs[x]  = new _dataSetObj(self,'I',inps[x]);
            }
            for (x in outs) {
                //console.log(x);
                props.outputs[x] = new _dataSetObj(self,'O',outs[x]);
            }

            props.info =  (mapJson['serviceInfo'] != undefined) ? mapJson['serviceInfo'] : {};
            fireEvent('ontest',['aaaa',self,elem,'bbbb',3]);
            //console.log('inited',props);
            if (callback !== undefined) callback(self);
        };

        function fireEvent(_evtName,_eventArg) {
            var dataEventFunc = function(evtObj){
                this.handler = function(waiEvent) {
                    var rt = null;
                    try {
                        var fn = (evtObj+'').replace('()','');
                        eval('rt = '+fn+'.apply(this,waiEvent);');
                    } catch(E) {
                        console.error('"'+elem.id+'.'+_evtName+'" event is wrong function name');
                    }
                    return rt;
                };
            };
            var evtStr = null;

            for (var x in svcOpts) {
                if (x == _evtName) { evtStr = svcOpts[x]; break; }
            }
            var rt = null;
            if (evtStr != null) {
                var evt = new dataEventFunc(evtStr);
                rt = evt.handler.apply(self,[_eventArg]);            
            }
            console.log('event rt = ',rt);
            return rt;
        }

        this.call = function(callOpt) {
            var cOpt = {
                'serviceUrl'   : null,
                'timeout'      : null,
                'moduleExec'   : null,
                'autoGather'   : null,
                'autoUpdate'   : null
            };
            var x;
            for (x in cOpt) cOpt[x] = props[x];
            if (callOpt != undefined) {
                for (x in cOpt) cOpt[x] = (callOpt[x] != undefined) ? callOpt[x] : cOpt[x];
            }
            console.log('call : cOpt = ',cOpt);
        };

        this.updateToScreen = function() {
            // 메모리상의 데이터를 화면에 연결된 객체들에 업데이트
        };

        this.screenToData = function() {
            // 화면에 연결된 객체들의 데이터를 메모리상의 데이터에 업데이트 
        };


        //---------------------------------------------------------------------------------------[ Create object flow ]
        self.init();
        (function(){
            var propText;
            var assignAttrs = [
                'autocall','serviceUrl'
            ];
            var x;
            for (x in props) {
                if (assignAttrs.indexOf(x) >= 0) continue; // skip "assignAttrs" properties
                propText = 'Object.defineProperty(self, "'+x+'", {'+
                           'get: function() { return props["'+x+'"]; }'+
                           //',set: function(v){ props["'+x+'"] = v; }'+
                           '});';
                eval(propText); //console.log(propText);
                propText = 'Object.defineProperty(elem, "'+x+'", {'+
                           'get: function() { return props["'+x+'"]; }'+
                           //',set: function(v){ props["'+x+'"] = v; }'+
                           '});';
                eval(propText); //console.log(propText);
            }

            for (var i=0;i<assignAttrs.length;i++) {
                x = assignAttrs[i];
                propText = 'Object.defineProperty(self, "'+x+'", {'+
                           'get: function() { return props["'+x+'"]; }'+
                           ',set: function(v){ props["'+x+'"] = v; $(elem).attr("'+x+'",(v+"")); }'+
                           '});';
                eval(propText); //console.log(propText);
                propText = 'Object.defineProperty(elem, "'+x+'", {'+
                           'get: function() { return props["'+x+'"]; }'+
                           ',set: function(v){ props["'+x+'"] = v; $(elem).attr("'+x+'",(v+"")); }'+
                           '});';
                eval(propText); //console.log(propText);                
            }
        })();
        Object.defineProperty(self,'elem',       { get:function() { return elem; } });        
        Object.defineProperty(self,'index',      { get:function() { return index; } });
    };
    //--------------------------------------------------------------------------------------------- [ Data Set Object ]
    var _dataSetObj = function(prtObj,dsIOTp,dsInfo) {
        const self   = this;
        const svcObj = prtObj;
        const ioType = (dsIOTp+'').toUpperCase();
        const info   = dsInfo;

        var fields      = {};
        var data        = [];

        function init() {
            var x;
            for (x in info) {
                fields[x] = new _dataFldObj(self,info[x]);
            }
            //console.log(fields);
        }
        init();

        function setData(newData) {
            var nd = newData;
            data = nd;
        }

        // read/write properties
        Object.defineProperty(self,'data',         { get:function() { return data; }, set:function(v) { setData(v); } });

        // read-only properties
        Object.defineProperty(self,'svcObj',       { get:function() { return svcObj; } });
        Object.defineProperty(self,'ioType',       { get:function() { return ioType; } });
        Object.defineProperty(self,'info',         { get:function() { return info; } });
        Object.defineProperty(self,'fields',       { get:function() { return fields; } });
        Object.defineProperty(self,'recordCount',  { get:function() { return data.length; } });
        Object.defineProperty(self,'fieldCount',   { get:function() { var x,cnt=0; for (x in fields) cnt++; return cnt; } });
    };
    //------------------------------------------------------------------------------------------- [ Data Field Object ]
    var _dataFldObj = function(prtObj,fdInfo) {
        const self  = this;
        const dsObj = prtObj;
        const info  = fdInfo;

        // read/write properties


        // read-only properties
        Object.defineProperty(self,'info',         { get:function() { return info; } });
    };


    {
        function generateElemToDataObj() {


        }
        
    }

    var _waiDataIO = function() {
        const self    = this;
        var defPath   = '/waiDataIO';
        this.classes  = {}; // class define
        this.services = []; // created service objects
        this.events   = {};

        const eventKeys = ['SVCBEFCALL','SVCAFTCALL','SVCERRCALL'];

        var defSvcOpt = {

        };
        var defModules = {};

        this.init = function() {
            console.log('data i/o service generate & Initialize');
            var loadUrl1 = defPath+'/'+defSvcOptFile;
            var loadUrl2 = defPath+'/'+defDataProcMd;
            //var loaded1  = false;
            //var loaded2  = false;

            $.ajax({
                type     : 'post',
                url      : loadUrl1,
                data     : {},
                dataType : 'json',
                async    : false,
                error    : function(xhr,sts,err) {
                    console.error('can not load "'+loadUrl1+'"',err);
                    //loaded1 = true;
                    //if (loaded1 && loaded2) generateDataElems();
                },
                success  : function(data,sts,xhr) {
                    console.log(data);
                    defSvcOpt = data;
                    //loaded1 = true;
                    //if (loaded1 && loaded2) generateDataElems();
                }
            });

            $.ajax({
                type     : 'post',
                url      : loadUrl2,
                data     : {},
                dataType : 'json',
                async    : false,
                error    : function(xhr,sts,err) {
                    console.error('can not load "'+loadUrl2+'"',err);
                    //loaded2 = true;
                    //if (loaded1 && loaded2) generateDataElems();
                },
                success  : function(data,sts,xhr) {
                    console.log(data);
                    defModules = data;
                    //loaded2 = true;
                    //if (loaded1 && loaded2) generateDataElems();
                }
            });

            generateDataElems();
        };

        function genSvcOptions(dioElem) {
            var svcOpts = {
                "onbeforecall" : null,
                "onaftercall"  : null,
                "oncallerror"  : null
                ,"ontest"       : null
            };
            var tmp = JSON.parse(JSON.stringify(defSvcOpt));
            for (var x in defSvcOpt) {
                svcOpts[x] = tmp[x];
            }

            var evts = $(dioElem).children('events');
            if (evts.length > 0) {
                var svcEvts = $(evts).children();
                for (var j=0;j<svcEvts.length;j++){
                    var tg = (svcEvts[j].tagName+'').toLowerCase();
                    for (var x in svcOpts) {
                        if (x == tg) {
                            svcOpts[tg] = $(svcEvts[j]).attr('onevent');
                        }
                    }
                }
            }

            return svcOpts;
        }

        function generateDataElems() {
            console.log('---generateDataElems');
            var dataio = $('dataio');

            for (var i=0;i<dataio.length;i++) {
                var svcOpts = genSvcOptions(dataio[i]);
                //console.log('svcOpts',svcOpts);
                var j,k;
                var svcs = $(dataio[i]).children('service');
                for (j=0;j<svcs.length;j++) {
                    var dso = new _dataServiceObj(self, svcs[j], svcOpts,i);
                    self.services.push(dso);
                }

                var evts = $(dataio[i]).children('events');
                for (j=0;j<evts.length;j++) {

                    for (k=0;k<eventKeys.length;k++) {
                        for (var x in defSvcOpt.events) {
                            if ( defSvcOpt.events[x].eventKey == eventKeys[k] ) {
                                var evtElem = $(dataio[i]).children(x);
                                if (evtElem.length > 0) {
                                    // todo : event object create processing

                                }
                            }
                        }
                        
                    }
                }
            }
        }        

        this.addNewService = function(tElem,callback) {
            var svcOpts = genSvcOptions(tElem.parentElement);
            console.log('svcOpts',svcOpts);            
            
            var dso = new _dataServiceObj(self, tElem, svcOpts, 0, callback);
            self.services.push(dso);
            return dso;
        };

        this.getElemsBySvc = function(svcElemId, ioTypes, dsName) {
            let sCond = svcElemId + '.';
            if (ioTypes) {
                sCond += ioTypes + '.';
                if (dsName) {
                    sCond += dsName;
                }
            }

            // 대소문자 구분 여부 확인 필요

            return Array.from($(`[datasrc^='${sCond}']`));

            /*
            var elems = $("[datasrc^='"+svcElemId+".']");
            var rt = [];
            for (var i=0;i<elems.length;i++) {
                if (ioTypes == undefined) {
                    rt.push(elems[i]);
                } else {
                    var io = (svcElemId+'.'+ioTypes+'.').toUpperCase();
                    var src = ($(elems[i]).attr('datasrc')+'').toUpperCase();
                    
                    if (src.indexOf(io) == 0) {
                        rt.push(elems[i]);
                    }
                }
            }
            return rt;
            */
        };

        Object.defineProperty(self,'defaultServiceOpts',{
            get : function() {
                return defSvcOpt;
            }
        })
    };

    waiDataIO = new _waiDataIO();
    waiDataIO['classes'] = {
        'dataService' : _dataServiceObj,
        'dataSet'     : _dataSetObj,
        'dataFld'     : _dataFldObj
    };

    $(document).ready(function(){
        waiDataIO.init();
    });
})();