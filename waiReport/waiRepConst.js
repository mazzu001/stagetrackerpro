(function(){
    if (typeof window !== 'undefined' && window['$waiReport'] === undefined) {
        window['$waiReport']  = {};
        $waiReport['message'] = {};
        $waiReport['const']   = {};
    }
    var _messages = function() {
        var msgConst = {
            // waiReport.core Messages
            compNotFound : {
                message: 'Y[wai] Report - "$1" Component not founded'
            },

            // Render Messages
            bandArgNot : {
                message: 'Can not create render class : waiReport "band" class has not argument'
            }
        };

        this.get = function(msg,args) {
            var rt = null;
            for (var x in msgConst){
                if (x == msg){
                    rt = msgConst[x].message;
                    break;
                }
            }
            if (rt === null){
                var e = new Error();
                console.error('$waiReport.message : "'+msg+'" not founded',e);
                return rt;
            }
            for (var i=0;i<args.length;i++) {
                var pt = '\\$'+(i+1);
                rt = rt.replace(new RegExp(pt,'gi'), args[i]);
            }
            return rt;
        };
    };
    $waiReport.message = new _messages();


    // reportHeader,reportFooter,pageHeader,pageFooter,groupHeader,groupFooter,groupDetail
    var _defaultBand = {
        "name":"",
        "type":"",
        "height" : 0,
        "objects" : [],
        "dataSource"  : null,
        "vbScript"    : "",

        "onBeforePrint" : "",
        "onAfterPrint"  : "",
        "onFormat"      : "",

        "backColor"       : '#ffffff',
        "backStyle"       : '0',

        "canGrow"         : true,
        "canShrink"       : false,
        "columnLayout"    : true,
        "dataField"       : "",
        "grpKeepTogether" : "0",
        "keepTogether"    : false,
        "newColumn"       : "0",
        "newPage"         : "0",
        "repeat"          : "0",
        "underlayNext"    : false,
        "visible"         : true
    };
    $waiReport.const['defaultBand'] = _defaultBand;
    $waiReport.const['newDefaultBand'] = function(){
        var rt = JSON.parse( JSON.stringify($waiReport.const.defaultBand) );
        return rt;
    };

    var _defaultPage = {
        "dataSource"  : null,
        "bands":[]
    };
    $waiReport.const['defaultPage'] = _defaultPage;
    $waiReport.const['newDefaultPage'] = function(){
        var rt = JSON.parse( JSON.stringify($waiReport.const.defaultPage) );
        return rt;
    };


    var _defaultForm = {
        "waiReportForm":{
            "version":"1.0.0",
            "license":""
        },
        "pageSetting":{
            "paper":{
                "type"   : "",
                "width"  : 0,
                "height" : 0
            },
            "margin":{
                "left":0,
                "right":0,
                "top":0,
                "bottom":0
            },
            "orientation":0  // 0 : Port // 1 : Land
        },
        // "dataSource":{
        // },
        "styles":{

        },
        "script":null,
        "vbScript":null,
        "layout":{
            "reportHeader":null,
            "pages":[

            ],
            "reportFooter":null
        }
    };
    $waiReport.const['defaultForm'] = _defaultForm;
    $waiReport.const['newDefaultForm'] = function(){
        var rt = JSON.parse( JSON.stringify($waiReport.const.defaultForm) );
        return rt;
    };

    var _defaultNewForm = {
        "waiReportForm": {
            "version": "1.0.0",
            "license": ""
        },
        "pageSetting": {
            "paper": {
                "type": "A4",
                "width": 2320,
                "height": 3308
            },
            "margin": {
                "left": 80,
                "right": 80,
                "top": 100,
                "bottom": 100
            },
            "orientation": 0
        },
        "styles": {},
        "script": null,
        "vbScript": "",
        "layout": {
            "reportHeader": {
                "name": "ReportHeader",
                "type": "reportHeader",
                "height": 150,
                "objects": [],
                "dataSource": null,
                "beforePrint": "",
                "afterPrint": "",
                "vbScript": ""
            },
            "pages": [
                {
                    "dataSource": null,
                    "bands": [
                        {
                            "name": "PageHeader",
                            "type": "pageHeader",
                            "height": 200,
                            "objects": [],
                            "dataSource": null,
                            "beforePrint": "",
                            "afterPrint": "",
                            "vbScript": ""
                        },
                        {
                            "name": "Detail",
                            "type": "detail",
                            "height": 300,
                            "objects": [],
                            "dataSource": null,
                            "beforePrint": "",
                            "afterPrint": "",
                            "vbScript": ""
                        },
                        {
                            "name": "PageFooter",
                            "type": "pageFooter",
                            "height": 200,
                            "objects": [],
                            "dataSource": null,
                            "beforePrint": "",
                            "afterPrint": "",
                            "vbScript": ""
                        }
                    ]
                }
            ],
            "reportFooter": {
                "name": "ReportFooter",
                "type": "reportFooter",
                "height": 150,
                "objects": [],
                "dataSource": null,
                "beforePrint": "",
                "afterPrint": "",
                "vbScript": ""
            }
        }
    };
    $waiReport.const['defaultNewData'] = _defaultNewForm;
    $waiReport.const['newDefaultData'] = function(){
        var rt = JSON.parse( JSON.stringify($waiReport.const.defaultNewData) );
        return rt;
    };

    $waiReport.const['compStyleFontProp'] = {
        'Name'       : {'value':'','css':'font-family'}, //,'ret':function(v){return "'"+(v+'').trim()+"'"}
        'Size'       : {'value':'','css':'font-size','gen':function(v){return ((typeof(v)==typeof(0))?(v+'pt'):v);}},
        'Style'      : {'value':'','css':'font-style'},
        'Weight'     : {'value':'','css':'font-weight'}
    };

    $waiReport.const['compStyleProp'] = {
        'Decoration' : {'value':'','css':'text-decoration'},
        'Align'      : {'value':'','css':'text-align'},
        'vAlign'     : {'value':'','css':'vertical-align'},
        'Color'      : {'value':'','css':'color'},
        'bgColor'    : {'value':'','css':'background-color'},
        'wordWrap'   : {'value':'','css':'white-space'},
        'overFlow'   : {'value':'','css':'overflow'}
    };

    $waiReport.const['defaultLabelStyle'] = {
        'wordWrap'   : 'nowrap',
        'overFlow'   : 'visible'
    };

    $waiReport.const['defaultTextboxStyle'] = {
        'wordWrap'   : 'normal'
    };

    $waiReport.const['defTextboxTabToSpace'] = {
        'convert' : true,
        'size'    : 1
    }

    $waiReport.const['fontScale'] = 3.97;

    $waiReport.const['defFontSize'] = '39px';

    // 기본 줄간격 설정으로 현재 객체의 폰트 크기에 따라서 줄간격이 달라짐
    // 예) 1.0 = 100% , 1.2 = 120% , 1.5 = 150% , 2.0 = 200% 가 되며
    //     자유롭게 설정할 수 있으나 1.0 이하의 경우 윗 줄과 아래줄이 겹칠 수 있음

    $waiReport.const['defLineHeightPercent'] = 1.25;


    $waiReport.const['defPropSelectValues'] = {
        'boolValue'     : [ {d:'True',v:'1'},{d:'False',v:'0'} ],
        'fillStyle'     : [ {d:'Transparent',v:'0'},{d:'Normal',v:'1'} ],
        'borderStyle'   : [ {d:'none',v:'0'},{d:'line',v:'1'},{d:'dash',v:'2'},{d:'dot',v:'3'},{d:'dash-dot',v:'4'},{d:'dash-dot-dot',v:'5'},
                            {d:'dobule line',v:'6'},{d:'bold line',v:'7'},{d:'bold dash',v:'8'},{d:'bold dot',v:'9'},{d:'bold dash-dot',v:'10'},
                            {d:'bold dash-dot-dot',v:'11'},{d:'bold double line',v:'12'},{d:'huge bold line',v:'13'} ],
        'lineStyle'     : [ {d:'Transparent',v:'0'}, {d:'Solid',v:'1'}, {d:'Dash',v:'2'},
                            {d:'Dot',v:'3'}, {d:'Dash-dot',v:'4'}, {d:'D ash-dot-dot',v:'5'} ],
        'verticalAlign' : [ {d:'Top',v:'top'},{d:'Middle',v:'middle'},{d:'Bottom',v:'bottom'} ],
        'alignment'     : [ {d:'Left',v:'left'},{d:'Center',v:'center'},{d:'Right',v:'right'} ],
        'imgAlign'      : [ {d:'Top Left',v:'0'},{d:'Top Right',v:'1'},{d:'Center',v:'2'},{d:'Bottom Left',v:'3'},{d:'Bottom Right',v:'4'} ],
        'imgSize'       : [ {d:'Clip',v:'0'},{d:'Stretch',v:'1'},{d:'Zoom',v:'2'} ],
        'wordWrap'      : [ {d:'True',v:'normal'},{d:'False',v:'nowrap'} ],
        'sumType'       : [ {d:'None',v:'0'},{d:'Grand Total',v:'1'},{d:'Page Total',v:'2'},{d:'Sub Total',v:'3'},{d:'Page Count',v:'4'} ],
        'sumRunning'    : [ {d:'None',v:'0'},{d:'Group',v:'1'},{d:'All',v:'2'} ],
        'newPage'       : [ {d:'None',v:'0'},{d:'before',v:'1'},{d:'after',v:'2'},{d:'before,after',v:'3'} ],
        'overFlow'      : [ {d:'Visible',v:'visible'}, {d:'Ellipsis',v:'ellipsis'}]
    };

    //------------------------------------------------------------------------------------------------------------------
    // Editor Font List for Y[wai] IDE
    //------------------------------------------------------------------------------------------------------------------

    $waiReport.const['editorFontList'] = [
        {name: "Gulim",             value: "Gulim"},
        {name: "GulimChe",          value: "GulimChe"},
        {name: "Gungsuh",           value: "Gungsuh"},
        {name: "GungsuhChe",        value: "GungsuhChe"},
        {name: "NanumGothic",       value: "NanumGothic"},
        {name: "Dotum",             value: "Dotum"},
        {name: "DotumChe",          value: "DotumChe"},
        {name: "Malgun Gothic",     value: "Malgun Gothic"},
        {name: "Batang",            value: "Batang"},
        {name: "BatangChe",         value: "BatangChe"},
        {name: "New Gulim",         value: "New Gulim"},
        {name: "Arial",             value: "Arial"},
        {name: "Arial Black",       value: "Arial Black"},
        {name: "Arial Narrow",      value: "Arial Narrow"},
        {name: "Bookman Old Style", value: "Bookman Old Style"},
        {name: "Century",           value: "Century"},
        {name: "Century Gothic",    value: "Century Gothic"},
        {name: "Comic Sans MS",     value: "Comic Sans MS"},
        {name: "Courier New",       value: "Courier New"},
        {name: "Cursive",           value: "Cursive"},
        {name: "fantasy",           value: "fantasy"},
        {name: "Garamond",          value: "Garamond"},
        {name: "Georgia",           value: "Georgia"},
        {name: "impact",            value: "impact"},
        {name: "Lucida Console",    value: "Lucida Console"},
        {name: "monospace",         value: "monospace"},
        {name: "MS Gothic",         value: "MS Gothic"},
        {name: "MS PGothic",        value: "MS PGothic"},
        {name: "MS Sans Serif",     value: "MS Sans Serif"},
        {name: "MS Serif",          value: "MS Serif"},
        {name: "sans-serif",        value: "sans-serif"},
        {name: "SimSun",            value: "SimSun"},
        {name: "Tahoma",            value: "Tahoma"},
        {name: "Times New Roman",   value: "Times New Roman"},
        {name: "Verdana",           value: "Verdana"}
    ];

    //------------------------------------------------------------------------------------------------------------------
    // Summary Functions
    //------------------------------------------------------------------------------------------------------------------
    $waiReport.const['summaryFuncs'] = {
        '0':{
            'name' : 'Sum',
            'func' : function() {
                var sum = 0.0;
                this.exec = function(val) {
                    var dbl = parseFloat((val+'').trim().replace(/,| /g,''));
                    if ((dbl+'')!=='NaN') {
                        sum+=dbl;
                    }
                };
                this.getValue = function(){
                    return sum;
                };
                this.clear = function() { sum = 0.0; };
            }
        },
        '1':{
            'name' : 'Avg',
            'func' : function() {
                var cnt = 0;
                var sum = 0.0;
                this.exec = function(val) {
                    var dbl = parseFloat((val+'').trim().replace(/,| /g,''));
                    if ((dbl+'')!=='NaN') {
                        sum+=dbl;
                    }
                    cnt++;
                };
                this.getValue = function(){
                    return (sum/cnt);
                };
                this.clear = function() { sum = 0.0; cnt=0; };
            }
        },
        '2':{
            'name' : 'Count',
            'func' : function() {
                var cnt = 0;
                this.exec = function(val) {
                    cnt++;
                };
                this.getValue = function(){
                    return cnt;
                };
                this.clear = function() { cnt = 0; };
            }
        },
        '3':{
            'name' : 'Min',
            'func' : function() {
                var min = null;
                this.exec = function(val) {
                    var dbl = parseFloat((val+'').trim().replace(/,| /g,''));
                    if ((dbl+'')!=='NaN') {
                        min = (min==null)?dbl:Math.min(min,dbl);
                    }
                };
                this.getValue = function(){
                    return min;
                };
                this.clear = function() { min = null; };
            }
        },
        '4':{
            'name' : 'Max',
            'func' : function() {
                var max = null;
                this.exec = function(val) {
                    var dbl = parseFloat((val+'').trim().replace(/,| /g,''));
                    if ((dbl+'')!=='NaN') {
                        max = (max==null)?dbl:Math.max(max,dbl);
                    }
                };
                this.getValue = function(){
                    return max;
                };
                this.clear = function() { max = null; };
            }
        }
    };

    $waiReport.const.defPropSelectValues['summaryFunc'] = [];
    for (var si in $waiReport.const.summaryFuncs ) {
        var val = {
            'd':$waiReport.const.summaryFuncs[si].name,
            'v':si
        };
        $waiReport.const.defPropSelectValues.summaryFunc.push(val);
    }

    //------------------------------------------------------------------------------------------------------------------
    // DateTime Default Formats
    //------------------------------------------------------------------------------------------------------------------
    $waiReport.const['defaultDateValueFormat'] = 'yyyymmdd';
    $waiReport.const['defaultTimeValueFormat'] = 'hhnnss';

    $waiReport.const['defTextBoxNowFormat']    = 'yyyy-mm-dd HH:nn:ss';
    $waiReport.const['defTextBoxDateFormat']   = 'yyyy-mm-dd';
    $waiReport.const['defTextBoxTimeFormat']   = 'HH:nn:ss';

    $waiReport.const['minBottomMarginPers']     = 40;
    $waiReport.const['minLeftRightMarginPers']  = 23;

    //------------------------------------------------------------------------------------------------------------------
    // Paper Ratio - 용지별 비율 설정
    //
    // 비율은 가로 대비 세로의 비율임 ( 용지 방향이 세로(vert), 가로(horz)에 따라서 다름 )
    //------------------------------------------------------------------------------------------------------------------
    $waiReport.const['paperRatios'] = {
        'A4' : { // 300dpi : 2480 x 3508 pixels
            'vert' : 1.41451,
            'horz' : 0.70695
        },
        'LETTER' : { // 300dpi : 2550 x 3300 pixels
            'vert' : 1.29411,
            'horz' : 0.77272
        }
    };
    $waiReport.const['paperPixel'] = {
        'A4' : { // 300dpi : 2480 x 3508 pixels
            'vert' : 3508,
            'horz' : 2480
        },
        'LETTER' : { // 300dpi : 2550 x 3300 pixels
            'vert' : 3300,
            'horz' : 2550
        }
    };

    //------------------------------------------------------------------------------------------------------------------
    // 아래의 미리보기(및 인쇄) 품질은 1 ~ 0.35 정도로 설정하며,
    // 0.35 이하의 경우 심하게 품질이 좋지 않으므로 가급적 설정하지 않는다.
    // 특히 IE11 의 경우 품질이 높은 경우 인쇄가 안되는 페이지가 생기는 현상이 있으며,
    // 속도 차이가 많이 발생한다. 품질이 낮을 수록 속도는 빠름
    // 값은 1 ~ 0.35 사이의 값으로 설정한다. 1을 초과하는 경우 인쇄 품질에 비하여 메모리를 너무 많이 사용하고
    // 0.35 이하로 설정할 경우 작은 글씨들의 인쇄 품질이 많이 낮아진다.
    
    $waiReport.const['printQuality'] = {
        'IE'    : 0.4,
        'Other' : 0.5
    };
    
    $waiReport.const['AjaxCallType'] = {
        'ReportService' : 'POST',
        'FormFileLoad'  : 'GET'
    };

    // 미리보기 화면이 처음 화면에 표시될 때, 기본 확대 종류 설정
    //------------------------------------------------------------------------------------------------------------------
    // 아래의 값들 중에서 선택하거나, 빈 문자열로 초기값을 설정 ( = auto 로 설정됨 )
    // 모든 값은 문자열 type 으로 설정한다.

    // ---- Zoom Options ----
    // auto             : 가로로 맞춤 - 90%
    // page-fit         : 세로로 맞춤 - 100%
    // page-width       : 가로로 맞춤 - 100%
    // 0.25             : 25% 비율로 보기
    // 0.5              : 25% 비율로 보기
    // 0.75             : 75% 비율로 보기
    // 1                : 100% 비율로 보기
    // 1.5              : 150% 비율로 보기
    // 2                : 200% 비율로 보기

    $waiReport.const['defaultPreviewZoom'] = 'page-fit';

    // 미리보기 화면 크기 조정 - waiReportAgent 에 previewOffset 에 초기값이 있으니 참고바람
    //------------------------------------------------------------------------------------------------------------------
    // 미리보기 화면이 처음 화면에 표시될 때, waiReportAgent.js 에 있는 previewOffset 의 미리보기 창의
    // left , top , width, height 를 고정 크기로 설정할 수 있으나, 화면 해상도에 따라서 조정이 불가능함.
    // 화면 해상도에 따라서 비율로 설정하려고 하면 아래의 $waiReport.const['previewFormResize'] 의
    // resize : true 로 설정하고, 각 width, height 에 1 ~ 0.1 의 값을 설정한다.
    // 예를 들어 width : 0.5 로 설정하면 가로 화면 해상도의 50% 로 모니터 해상도가 1280 이라면 대략 640 크기로
    // 설정된다. ( 창의 틀 크기나 여백이나 등등의 Windows 설정에 따라서 약간의 오차는 발생된다. )

    $waiReport.const['previewFormResize'] = {
        resize  : true,
        width   : 0.6,
        height  : 0.9
    };

    // IE 를 제외한 브라우저에서 미리보기 화면 생성중 이미지 설정
    //------------------------------------------------------------------------------------------------------------------
    // 미리보기 화면이 처음 화면에 표시되고, 레포트가 Generate 되는 시간동안 표시될 애니메이션 Gif 의 URL 을
    // 설정합니다. ( /images/progress.gif 와 같이 설정합니다. )
    // 설정값이 비었으면 waiReport 기본 Gif 가 사용됩니다. ( IE 는 지원되지 않는 기능입니다 )
    // ( 애니메이션 Gif 가 아닌 다른 이미지도 상관은 없습니다. )

    $waiReport.const['previewWaitGif'] = '';

    // IE 에서 미리보기 화면 생성중 이미지 설정
    //------------------------------------------------------------------------------------------------------------------
    // 아래의 설정은 IE 일경우에 이미지입니다. 비어 있는 경우 이미지를 로딩하지 않습니다.
    // 애니메이션 Gif 를 넣어도 IE 는 애니메이션이 멈추기 때문에 의미가 없으니,
    // 일반 이미지를 설정할 때 사용하시기 바랍니다.
    $waiReport.const['previewWaitIE'] = '/Y[wai]/images/ideMon.png';

    // NodeJS 서버 Preview PDF 생성시 기본 폰트
    //------------------------------------------------------------------------------------------------------------------
    $waiReport.const['serverDefFont'] = 'Noto Sans CJK KR';
})();
