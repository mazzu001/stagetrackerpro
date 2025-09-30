(function(){
    var _waiDefaults = function() {

        this.dataServiceDefault = {
            //--------------------------------------------
            // properties - default value setting
            mapUrl      : '',
            serviceUrl  : 'http://127.0.0.1/dataChange_data.xml',
            serviceName : '',
            methodName  : '',
            dsoNames    : '',

            timeOut     : 5000,
            async       : false,
            mapType     : 'xml',
            dataType    : 'xml',
            dsoPublic   : true,

            onErrorThrow : false,
            //--------------------------------------------
            // event callback(s) // do not change value(s)
            onBeforeCall       : null,
            onBeforeCallAttach : null,
            onAfterCallDetach  : null,
            onAfterCall        : null,
            onResultError      : null,
            //--------------------------------------------
            // Etc Options
            fieldNameCaseSen   : 'upper'   // upper = upperCase convert // lower = lowerCase convert // none
        };

        this.downInfo = {
            serviceDomain   : 'ws://127.0.0.1:9892',
            webRoots        : '/',
            websocket       : false,
            dataService     : 'http://127.0.0.1:8090/JSONDataService',
            async           : true,
            timeOut         : 10000,
            serviceLog      : false
        };

        this.clientServiceDefault = {
            port        : 9515
        };

        this.autoLoadJsFile = true;

        this.enableDSO = false; // Whether use DSO editor in designer for waiVSCode
        this.waiDataIoUse = false;
        this.libUse = false;
        this.libPath = "/lib";
        this.multiLangUse = false;
        // this.multiLangDicDataPath = '/config/multiLang';
        // this.multiLangDicDataPath = '/config/multiLang/waiMultiLangData.json';
        this.multiLangDicDataPath = '';
        this.defaultLang = 'EN';
        this.defaultTitleLang = 'EN';
        this.codeDataUse = false;
        // this.codeDataDicDataPath = '/config/codeData';
        this.codeDataDicDataPath = '/config/codeData/waiMetaCodeData.json';
        this.genarateSingleObjectDSO = false; // for PTHanabank, BEST terminal
        this.showTimestampLog = false;

        this.dateFormat    = 'yyyymmdd';
        this.dateSeparator = '/';
        this.getDateFormat = ''; //dd-mm-yyyy
        this.arbitrary_precision = false; // arbitrary-precision arithmetic. (true: string, false: number)
        this.grid_CheckEditValue = [ true, false ];
        this.grid_CheckEditValueIgnorecase = false;
        this.grid_ContextMenu = {
            saveExcel: true,
            savePDF: true,
            saveImg: true
        };
        // this.cbDefCamelCase = true; // <codecombo> idField, textField default case
        this.cbInputUppercase = true; // <codecombo> input field 대문자 적용
        this.edit_maskDefValOnBlur = false;
        this.edit_getCurrencyEmptyVal = true; // true : '', false : '0.00' or 0
        this.dateLang = 'EN';
        this.dateLangData = {
            'EN' : { // English
                weeks: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                ,months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                ,todayText: 'Today'
                ,closeText: 'Close'
            },
            'KR' : { // Korean
                weeks: ['일', '월', '화', '수', '목', '금', '토']
                ,months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
                ,todayText: '오늘'
                ,closeText: '닫기'
            },
            'CN' : { // Chinese
                weeks: ['日', '月', '火', '水', '木', '金', '土']
                ,months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
                ,todayText: '今天'
                ,closeText: '关闭'
            },
            'ID' : { // Indonesian
                weeks: ['M', 'S', 'S', 'R', 'K', 'J', 'S']
                ,months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
                ,todayText: 'Hari ini'
                ,closeText: 'Menutup'
            },
            'JP' : { // Japanese
                weeks: ['日', '月', '火', '水', '木', '金', '土']
                ,months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
                ,todayText: '今日'
                ,closeText: '選ぶ'
            }
        };

        this.editorFontList = [
            {name: "굴림",              value: "Gulim"},
            {name: "굴림체",            value: "GulimChe"},
            {name: "궁서",              value: "Gungsuh"},
            {name: "궁서체",            value: "GungsuhChe"},
            {name: "나눔고딕",          value: "NanumGothic"},
            {name: "돋움",              value: "Dotum"},
            {name: "돋움체",            value: "DotumChe"},
            {name: "맑은 고딕",         value: "Malgun Gothic"},
            {name: "바탕",              value: "Batang"},
            {name: "바탕체",            value: "BatangChe"},
            {name: "새굴림",            value: "New Gulim"},
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

        this.SerialNumber  = "524139A916F655B6E35C295F70D4E9BC";

        this.common_module_path = "/modules";
        this.common_module_load_type = 0; //0. disable 1. global 2. local

    };

    $wai.default = new _waiDefaults();
})();
// END of file