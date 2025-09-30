/**
 * @license - Y[wai] 1.5.0
 *
 * Pure Web RIA Development Solution / <COMPONENT> Module
 *
 * (c) 2014-2015 Corebank Co.,Ltd. http://www.corebank.co.kr
 * License: Copyright(C) COREBANK. all right reserved.
 * -----------------------------------------------------------------------------
 * 본 소프트웨어(Javascript Source)는 '(주)코아뱅크'의 자산으로
 * Y[wai] 솔루션에 포함되어 있습니다.
 *
 * 본 소프트웨어를 Y[wai] 가 납품되어진 프로젝트 혹은 시스템이
 * 아닌 다른 목적으로 이용되어짐을 금하며, 본 소프트웨어를 임의로
 * 수정하여 비정상적으로 작동되어 지는 경우 당사에서 책임지지 않습니다.
 * -----------------------------------------------------------------------------
 * 사용되어지는 각 각의 컴포넌트(혹은 라이브러리)들은 Y[wai] 에 제품에 포함되어
 * 있지 않는 Source (들)이 있을 수 있으며, 이런 소스들의 경우 해당 License 를
 * 준수하시기 바랍니다.
 *
 * 기본적으로 Y[wai] 에 배포되어 사용되어 지는 각 각의 소스에는
 * 해당 소스의 License 파일이 포함되어 있거나 해당 소스에 명시되어 있으며,
 * Y[wai] 는 사용되어지는 모든 소스의 라이선스를 준수합니다.
 * -----------------------------------------------------------------------------
 * @description :
 * Y[wai] chart Component로 canvas형태의 다양한 차트를 지원하는 컴포넌트입니다.
 *-----------------------------------------------------------------------------
 * @Classes
 *
 *-----------------------------------------------------------------------------
 * @FileName : chart.js
 * @Version : 1.0.0
 * @Part : 코아뱅크기술연구소
 * @Create : 김지니 / August, 2015
 */
/* CoreDoc Source Comment
<CDSRCMT>
{
    "category":"wai.component.chart",
    "title":"Y[wai] Component Chart",
    "description":"Y[wai] chart Component로 canvas형태의 다양한 차트를 지원하는 컴포넌트",
    "history":[
        {"id":"jini","type":"create","date":"2015-08-01"}
    ],
    "screens":[
        {"file":"/wai/comp/chart_bar.png","desc":"Bar Chart 생성 예제"},
        {"file":"/wai/comp/chart_line.png","desc":"Line Chart 생성 예제"},
        {"file":"/wai/comp/chart_radar.png","desc":"Radar Chart 생성 예제"},
        {"file":"/wai/comp/chart_polarArea.png","desc":"PolarArea. Chart 생성 예제"},
        {"file":"/wai/comp/chart_pie.png","desc":"Pie Chart 생성 예제"},
        {"file":"/wai/comp/chart_doughnut.png","desc":"Doughnut Chart 생성 예제"}
    ]
}
</CDSRCMT>
*/
(function() {
    var CompBase = {
        declare       : {
            'tagName'     : 'chart',
            'template'    :
                '<div yid="chartdiv" ><canvas yid="ychart"></canvas></div>',
            'replace'     : true,       // true : 컴스텀 태그를 HTML 변경 / false : 커스텀 태그 밑으로 HTML 생성
            'noneVisible' : false,     // 컴포넌트 유형 설정 ( false : 보이는 형태 / true : 보이지 않는 형태 )
            'isDataSource': false      // 데이터 소스 형태 컴포넌트 ( true : 예 / false : 아니오 )
        },
        properties : {
            'dsoName'   : {'type': typeof(''), regex: '', readonly: false, defaultValue: ''},
            'fldName'   : {'type': typeof(''), regex: '', readonly: false, defaultValue: ''},
            'type'      : {'type': 'select',   regex: '', readonly: false, defaultValue: '', items:['bar','line','radar','polarArea','pie','doughnut']},
            'data'      : {'type': 'jsonData', regex: '', readonly: false, defaultValue: ''},
            'option'    : {'type': 'jsonData', regex: '', editor:'chartEditor.html', readonly: false, defaultValue: ''},
            'style'     : {'type': typeof(''), regex: '', readonly: false, defaultValue: ''}
        },
        dataLink      : {
            'dsoName' : 'dsoName',
            'fldName' : 'fldName'
        },

        methods : {
            'getData' : {
                'argumentCheck' : false,
                'argumentDefine': {
                },
                'methodCode'    : function ($args) {
                    var data = '';
                    var uType = this.type.toUpperCase();
                    if(uType == 'BAR' || uType == 'LINE' || uType == 'RADAR'){
                        var data = this.chartObj.datasets;
                    }
                    else if(uType == 'POLARAREA' || uType == 'PIE' || uType == 'DOUGHNUT'){
                        var data = this.chartObj.segments;
                    }
                    return data;
                }
            },
            'update' : {
                'argumentCheck' : false,
                'argumentDefine': {
                    'arg1': {'type': typeof(''), defaultValue: null},
                    'arg2': {'type': typeof(''), defaultValue: null},
                    'arg3': {'type': typeof(''), defaultValue: undefined}
                },
                'methodCode'    : function ($args) {
                    var uType = this.type.toUpperCase();
                    if(uType == 'BAR'){
                        this.chartObj.datasets[$args.arg2].bars[$args.arg3].value = $args.arg1;
                        this.chartObj.update();
                    }
                    else if(uType == 'LINE' || uType == 'RADAR'){
                        this.chartObj.datasets[$args.arg2].points[$args.arg3].value = $args.arg1;
                        this.chartObj.update();
                    }
                    else if(uType == 'POLARAREA' || uType == 'PIE' || uType == 'DOUGHNUT'){
                        this.chartObj.segments[$args.arg2].value = $args.arg1;
                        this.chartObj.update();
                    }
                }
            },
            'addData' : {
                'argumentCheck' : false,
                'argumentDefine': {
                    'arg1': {'type': typeof({}), defaultValue: null},
                    'arg2': {'type': typeof(''), defaultValue: undefined}
                },
                'methodCode'    : function ($args) {
                    this.chartObj.addData($args.arg1,$args.arg2);
                }
            },
            'removeData' : {
                'argumentCheck' : false,
                'argumentDefine': {
                    'arg1': {'type': typeof(''), defaultValue: null}
                },
                'methodCode'    : function ($args) {
                    this.chartObj.removeData($args.arg1);
                }
            },
            'setData' : {
                'argumentCheck' : false,
                'argumentDefine': {
                    'arg1': {'type': typeof(''), defaultValue: null},
                    'arg2': {'type': typeof(''), defaultValue: undefined}
                },
                'methodCode'    : function ($args) {
                    //this.chartObj.destroy();    // HTMLCanvasElement 초기화
                    this.data = $args.arg1;     // 데이타 변경
                    //option이 들어오면 세팅
                    if($args.arg2 != undefined) {
                        this.option = $args.arg2;
                    }
                    this.initialize();           // 초기화
                }
            },
            //todo : this.data가 updata/addData/removeData 안되서 옵션바꿀때 데이타 초기화되버림...
            'setOption' : {
                'argumentCheck' : false,
                'argumentDefine': {
                    'arg1': {'type': typeof(''), defaultValue: null}
                },
                'methodCode'    : function ($args) {
                    //this.chartObj.destroy();    // HTMLCanvasElement 초기화
                    this.option = $args.arg1;   // 데이타 변경
                    this.initialize();           // 초기화
                }
            }
        },
        controls      : {
            'ychart':{
                'click':function($evt){
                    var dataInfo = '';
                    var uType = this.type.toUpperCase();

                    if(uType == 'BAR'){
                        var dataInfo = this.chartObj.getBarsAtEvent(event);
                    }
                    else if(uType == 'LINE' || uType == 'RADAR'){
                        var dataInfo = this.chartObj.getPointsAtEvent(event);
                    }
                    else if(uType == 'POLARAREA' || uType == 'PIE' || uType == 'DOUGHNUT'){
                        var dataInfo = this.chartObj.getSegmentsAtEvent(event);
                    }
                    this.FireEvent('onClick',{data:dataInfo});
                }
            }
        },
        events : {
            'onClick' : {
                data : { type:typeof({}) }
            },
            'resize' : {
                callback:{}
            }
        },
        watches       : {
            //'chartdiv.style' : 'cssText'
            'chartdiv' : 'style',
            'ychart' : 'fldName, dsoName, type, data, option, style'
        },

        initialize    : function ($yelem, $attrs) {
            //console.log('chart.$yelem : ',$yelem);
            //console.log('chart.$attrs : ',$attrs);
            /* 전역변수 객체 선언 */
            this.chartObj = null;

            $(this.child.chartdiv).attr('style',this.style);
            var chartdiv = $(this)[0].child.chartdiv;
            var ychart = $(this)[0].child.ychart;
            ychart.style.width = chartdiv.style.width;
            ychart.style.height = chartdiv.style.height;

            if (this.divResizeIntv !== undefined) {
                window.clearInterval(this.divResizeIntv);
            }

            this.divResizeIntv = window.setInterval(onDivResize,250);

            function onDivResize(){
                if (ychart.style.width != chartdiv.style.width) {
                    ychart.style.width = chartdiv.style.width;
                }
                if (ychart.style.height != chartdiv.style.height) {
                    ychart.style.height = chartdiv.style.height;
                }
            }

            // todo : 차트옵션 중 responsive: true가 안먹는 이유 -> chartdiv에 height,width 가 있으면 안먹음..
            /* responsive 속성 제어를 위한 코딩 */
            if(this.option.responsive == true){
                //this.child.chartdiv.style.height = '';
                //this.child.chartdiv.style.width = '';
                //console.log('height : '+this.child.chartdiv.style.height + '\nwidth : '+this.child.chartdiv.style.width);
            }


            if($attrs !== null && $attrs !== undefined && $attrs !='') {
                if ($attrs.data !== null && $attrs.data !== undefined && $attrs.data != '') {
                    this.data = $wai.util.getJSONAttribute($attrs.data);
                }
                if ($attrs.option !== null && $attrs.option !== undefined && $attrs.option != '') {
                    this.option = $wai.util.getJSONAttribute($attrs.option);
                }
            }
            if (this.data !== null && this.data !== undefined && this.data != '') {
                if(typeof this.data != 'object'){
                    this.data = JSON.parse(this.data);
                }
            }
            if (this.option !== null && this.option !== undefined && this.option != '') {
                if(typeof this.option != 'object'){
                    this.option = JSON.parse(this.option);
                }
            }

            //console.log("this.data : ",this.data[0]);
            //console.log("this.option : ",this.option);
            //if(this.data.datasets === undefined){
            //    if(this.data[0] === undefined){
            //        console.warn('Please enter data.');
            //        return;
            //    }
            //}
            if(this.data == '' || this.data === undefined || this.data === null){
                var uType = this.type.toUpperCase();
                if(uType == 'BAR'){
                    this.data = {
                        "labels": [],
                        "datasets": [
                            {
                                "label": "",
                                "fillColor": "",
                                "strokeColor": "",
                                "highlightFill": "",
                                "highlightStroke": "",
                                "data": []
                            }
                        ]
                    }
                }else if(uType == 'LINE' || uType=='RADAR'){
                    this.data = {
                        "labels": [],
                        "datasets": [
                            {
                                "label": "",
                                "fillColor": "",
                                "strokeColor": "",
                                "pointColor": "",
                                "pointStrokeColor": "",
                                "pointHighlightFill": "",
                                "pointHighlightStroke": "",
                                "data": []
                            }
                        ]
                    }
                }else if(uType == 'POLARAREA' || uType == 'PIE' || uType == 'DOUGHNUT'){
                    this.data = [
                        {
                            "value": 0,
                            "color": "",
                            "highlight": "",
                            "label": ""
                        }
                    ]
                }else{
                    console.warn("Please enter type.");
                    return;
                }
            }

            if(this.data != '' && this.data != undefined && this.data !== null){
                var uType = this.type.toUpperCase();
                var ctx = this.child.ychart.getContext('2d');

                /* type별 CHART MASK 적용 */
                if(uType == 'BAR'){
                    var chartBar = new Chart(ctx).Bar(this.data, this.option);
                    this.chartObj = chartBar;
                }
                else if(uType == 'LINE'){
                    var chartLine = new Chart(ctx).Line(this.data, this.option);
                    this.chartObj = chartLine;
                }
                else if(uType == 'RADAR'){
                    var chartRadar = new Chart(ctx).Radar(this.data, this.option);
                    this.chartObj = chartRadar;
                }
                else if(uType == 'POLARAREA'){
                    var chartPolarArea = new Chart(ctx).PolarArea(this.data, this.option);
                    this.chartObj = chartPolarArea;
                }
                else if(uType == 'PIE'){
                    var chartPie = new Chart(ctx).Pie(this.data, this.option);
                    this.chartObj = chartPie;
                }
                else if(uType == 'DOUGHNUT'){
                    var chartDoughnut = new Chart(ctx).Doughnut(this.data, this.option);
                    this.chartObj = chartDoughnut;
                }
                else{
                    console.error('type error. \nPlease enter type [ bar, line, radar,polarArea, pie, doughnut ]');
                }
            }else{
                console.warn('Please enter data.');
            }

            this.container = this.child.chartdiv;
            //console.log('============[[[ '+this.id+' initialize END ]]]============');
        },



        propertyChange: function (propName, oldValue, newValue) {
            propName = propName.toUpperCase();
            //console.log(this.id + ' : < propertyChange > \npropName = [ '+propName+' ], oldValue = [ '+oldValue+' ], newValue = [ '+newValue+' ]');

            if (oldValue != newValue) {

                if(this.chartObj !== null && this.chartObj !== undefined && this.chartObj !== ''){
                    this.chartObj.destroy();            // HTMLCanvasElement 초기화
                }

                if (propName == 'TYPE') {
                    this.type = newValue;
                    var newType = newValue.toUpperCase();
                    var oldType = oldValue.toUpperCase();
                    if(newType == "BAR" || oldType == "BAR") this.data = "";
                    else if((newType=="LINE") && (oldType!="RADAR")) this.data = "";
                    else if((newType=="RADAR") && (oldType!="LINE")) this.data = "";
                    else if((newType=="POLARAREA") && (oldType=="BAR" || oldType=="LINE" || oldType=="RADAR")) this.data = "";
                    else if((newType=="PIE") && (oldType=="BAR" || oldType=="LINE" || oldType=="RADAR")) this.data = "";
                    else if((newType=="DOUGHNUT") && (oldType=="BAR" || oldType=="LINE" || oldType=="RADAR")) this.data = "";
                    this.initialize();
                }
                else if (propName == 'DATA') {
                    if(typeof newValue != 'object'){
                        this.data = JSON.parse(newValue);
                    }else{
                        this.data = newValue;
                    }
                    this.initialize();
                }
                else if (propName == 'OPTION') {
                    if(typeof newValue != 'object'){
                        this.option = JSON.parse(newValue);
                    }else{
                        this.option = newValue;
                    }
                    this.initialize();
                }
                else if (propName == 'STYLE') {
                    this.style = newValue;
                    $(this.child.chartdiv).attr('style', this.style);
                    this.initialize();
                }
            }
        },
        elementChange : function (childName, $childElem, propName, oldValue, newValue) {
            //console.log(childName, $childElem, propName, oldValue, newValue);
        },
        dsoDataChange  : function (dso, dsoName, fldName, oldValue, newValue) {
        },
        destroy       : function ($elem, $attrs) {

        }
    };
    $wai.core.addComponentBase(CompBase);
})();
