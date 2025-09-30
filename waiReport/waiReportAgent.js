// 본 소스는 waiReport 를 적은 메모리 양과 (메모리의 효율적인 관리 포함)
// 빠른 로딩속도를 위한 소스입니다.
// 본 소스를 개별 업무 페이지에서 로딩하여 사용하거나, 이미 개별 업무 페이지에서 공통적으로 사용하고 있는 소스에
// 추가하여(권장) 사용합니다.
// 추가 방법은 본 주석 아래의 { 부터 소스의 맨 아래의 } 까지 { } 기호를 포함하여 개별 업무 페이지의 공통 스크립트에
// 추가합니다.

{   // Start "waiReportAgent" script
    if (window['$waiReport'] === undefined) { window['$waiReport'] = {'classes':{}}; }
    (function(){
        var defaultViewerURL = '/waiReport/window/yrPreview.html';
        var previewOffset = {
            left   : 50,
            top    : 50,
            width  : 1024,
            height : 768
        };

        function setUserOffset(PO) {}

        function splashOpen(url, wndName, buffer) {
            var PO = previewOffset;
            if ($waiReport.setUserOffset) {
                $waiReport.setUserOffset(PO);
            }
            var winFeatures = 'scrollbars,resizable=yes,screenX='+PO.left+',screenY='+PO.top+',top='+PO.top+',left='+PO.left+',width='+PO.width+',height='+PO.height;
            var winName = wndName;
            var win = window.open(url,winName, winFeatures);
            win.buffer = buffer;
            return win;
        }
        function dt2str( d ) { return (''+d.getFullYear()+d.getMonth()+d.getDay()+d.getHours()+d.getHours()+d.getMinutes()+d.getSeconds()+d.getMilliseconds()); }
        var _yrReportBuffer = function() {
            var self = this;
            var _vendors = [];
            var defServerPrev = true;
            var genServerPrev = { data : true , input : undefined};
            var defDataCompress = true;
            var dataCompress  = { data : true , input : undefined};
            this.viewerURL = defaultViewerURL;
            this.addVendor = function(vendor) { _vendors.push( vendor ); };
            this.getVendor = function() { var rt = _vendors.pop(); return rt; };
            this.clear = function() { _vendors = []; };
            this.show = function(vPreview) { return self.Show(vPreview); };
            this.print = function() { return self.Show(false);}
            this.Show = function(vPreview) {
                if (vPreview === undefined) vPreview = true;
                var noCache = dt2str( new Date() );
                for (var i=0;i<_vendors.length;i++) { _vendors[i].doPrint = !(vPreview); }
                if (vPreview === true) {
                    // Preview Processing
                } else {
                    // Print Processing
                }
                var dlgUrl = self.viewerURL+'?noMultiCache='+noCache;

                // Preview 화면 생성 방식 설정
                if(genServerPrev.input === undefined) genServerPrev.input = defServerPrev;
                genServerPrev.data = genServerPrev.input;
                genServerPrev.input = undefined;
                
                // 데이터 압축 방식 설정
                if(dataCompress.input === undefined) dataCompress.input = defDataCompress;
                dataCompress.data = dataCompress.input;
                dataCompress.input = undefined;

                return splashOpen(dlgUrl,'_blank', self);
            };
            Object.defineProperty(this,"vendors",{ get : function(){ return _vendors; } });
            Object.defineProperty(this,"dataCompress",{ 
                get : function(){ return dataCompress; }, 
                set : function(v){ return dataCompress.input=v; } 
            });
            Object.defineProperty(this,"genServerPrev",{ 
                get : function(){ return genServerPrev; }, 
                set : function(v){ return genServerPrev.input=v; } 
            });
        };
        var _waiReportFact = function() {
            var self = this;
            this._isMerge = false;
            this.ReportUrl = '';
            var _JSON = [{}];
            this.DetailJSON = null;
            this.addedDatas = [];
            this.doPrint = false;
            this.quality = null;
            this.viewerURL = defaultViewerURL;
            this.AddDataForId = function(objName,propName,propValue){ self.addedDatas.push({'s' : null, 'o' : objName,'p' : propName,'v' : propValue}); };
            this.AddData = function(secName,objName,propName,propValue){ self.addedDatas.push({'s' : secName,'o' : objName,'p' : propName,'v' : propValue}); };
            this.Show = function(vPreview){
                if (vPreview === undefined) vPreview = true;
                var noCache = dt2str( new Date() );
                self.doPrint = !(vPreview);
                if (vPreview === true) {
                    // Preview Processing
                } else {
                    // Print Processing
                }
                /**
                 * Vendor Show를 하는 경우에는 공통 버퍼 처리하지 않고 개별 처리하도록 설정
                 */
                // $waiReport.buffer.addVendor( self );
                var tmpBuffer = new $waiReport.classes.buffer(); 
                tmpBuffer.addVendor(self);
                var dlgUrl = self.viewerURL+'?noAgentCache='+noCache;
                return splashOpen(dlgUrl,'_blank', tmpBuffer);
            };
            this.Print = function() { self.Show(false); };
            this.addBuffer = function(buffer) {
                self.doPrint = false;
                self._isMerge = true;
                if (buffer) {
                    buffer.addVendor( self );
                } else {
                    $waiReport.buffer.addVendor( self );
                }
            };
            this.newLine2Rec = function(strs,fldName,nlSepa) {
                var sp = (nlSepa===undefined)?'\n':nlSepa;
                var rt = [];
                var fd = (fldName===undefined)?'text':fldName;
                var dt = (strs+'').split(sp);
                var o = null;

                if (dt.length == 0) dt = [''];
                if (dt.length ==  1) {
                    o = {};
                    o[fd] = dt[0];
                    rt.push(o);
                } else {
                    for (var i=0;i<dt.length;i++) {
                        o = {};
                        o[fd] = dt[i];
                        rt.push(o);
                    }
                }
                return rt;
            };
            this.vertMergeData = function( vData, fName, mOpt ) {
                var i;
                var cur = '';
                for (i=0;i<vData.length;i++) {
                    if ((i==0)||(cur=='')) {
                        cur = vData[i][fName];
                    } else {
                        if (vData[i][fName] == cur) {
                            vData[i][fName] = '';
                            if (mOpt !== undefined) {
                                vData[i-1][fName] = vData[i-1][fName] + mOpt;
                            }
                        } else {
                            cur = vData[i][fName];
                        }
                    }
                }
            };
            Object.defineProperty(this,"JSON",{ 
                get : function(){ return _JSON; },
                set : function(v){ _JSON = JSON.parse(JSON.stringify(v)); } 
            });
        };
        $waiReport['setUserOffset'] = setUserOffset;
        $waiReport['buffer'] = new _yrReportBuffer();
        $waiReport.classes['buffer'] = _yrReportBuffer;
        $waiReport.classes['reportVendor'] = _waiReportFact;
    })();
}    // End "waiReportAgent" script
