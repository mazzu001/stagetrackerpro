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
 (function() {
    var YRCompBase = {
        declare: {
            'type': 'chart',
            'default': {}
        },
        properties: {
            'cType': {'type': 'select', visible: true, readonly: false, defaultValue: '', values: [ {d:'bar',v:'bar'}, {d:'line',v:'line'}, {d:'radar',v:'radar'}, {d:'polarArea',v:'polarArea'}, {d:'pie',v:'pie'}, {d:'doughnut',v:'doughnut'}]},
            /*'data': {'type': 'jsonData', visible: true, readonly: false, defaultValue: ''},
            'option': {'type': 'jsonData', visible: true, editor: 'chartEditor.html', readonly: false, defaultValue: ''},*/
            'dataField'      : {'type': typeof(''), visible: true, readonly: false, defaultValue: ''},
            // 'optionField'    : {'type': typeof(''), visible: true, readonly: false, defaultValue: ''},
            'data'           : {'type': 'jsonData', visible: true, regex: '', editor:'chartDataEditor', readonly: false, defaultValue: ''},
            'options'        : {'type': 'jsonData', visible: true, regex: '', editor:'chartEditor', readonly: false, defaultValue: ''}
            //'title':  {'type': typeof(''), visible: true, readonly: false, defaultValue: ''}
        },
        initialize: function () {
            this.oldType = "";
            this.ychart = document.createElement("canvas");
            this.ychart.width = this.width;
            this.ychart.height = this.height;
            this.yctx = this.ychart.getContext('2d',{willReadFrequently: true});
            this.band.canvas.appendChild(this.ychart);
            /*for(var i=0; i<this.band.canvas.children.length; i++) {
             this.band.canvas.children[i].remove();  // remove canvas
             }*/

            //=======================
            /* 전역변수 객체 선언 */
            this.chartObj = null;
            /* 이벤트 제거 */

            if (typeof(this.style) != 'object') {
                $(this.child.chartdiv).attr('style', this.style);
            }

            /**
             * animation 값이 있는 경우 ChartJS 객체 생성 후
             * getImageData 를 얻어올 때 duration이 동작 중인 경우
             * canvas에 차트가 그려지지 않는 경우가 생김
             */
            if (this.options) {
                if (this.options.animation) {
                    this.options.animation.duration = 0;
                } else {
                    this.options.animation = {duration : 0}
                }

                this.options.responsive = false;

                if (this.options.plugins) {
                    if(this.options.plugins.tooltip){
                        this.options.plugins.tooltip.enabled = false;
                    }else{
                        this.options.plugins.tooltip = {enabled : false}
                    }
                }else{
                    this.options.plugins = {tooltip: {enabled : false}}
                }
            } else {
                this.options = {
                    animation : { duration : 0 },
                    responsive : false,
                    plugins : {
                        tooltip: {
                            enabled : false
                        }
                    }
                }
            }

            /*console.log(this)
            var ychart = $(this)[0].child.ychart;
            ychart.style.width = chartdiv.style.width;
            ychart.style.height = chartdiv.style.height;

            if (this.divResizeIntv !== undefined) {
                window.clearInterval(this.divResizeIntv);
            }

             */
            //this.divResizeIntv = window.setInterval(onDivResize,250);

            /*function onDivResize(){
                /!*if (ychart.style.width != chartdiv.style.width) {
                    ychart.style.width = chartdiv.style.width;
                }
                if (ychart.style.height != chartdiv.style.height) {
                    ychart.style.height = chartdiv.style.height;
                }*!/
            }*/
            // todo : 차트옵션 중 responsive: true가 안먹는 이유 -> chartdiv에 height,width 가 있으면 안먹음..
            /* responsive 속성 제어를 위한 코딩 */
            if (this.data !== null && this.data !== undefined && this.data != '') {
                if (typeof this.data != 'object') {
                    this.data = JSON.parse(this.data);
                }
            }

            if (this.options !== null && this.options !== undefined && this.options != '') {
                if (typeof this.options != 'object') {
                    this.options = JSON.parse(this.options);
                }
            }
            // console.log('============[[[ '+this.id+' initialize END ]]]============');
        },

        execDraw: function (aCtx, aData) {
            Chart.register({
                id: 'customShowPieceLabel',
                afterDraw: function (chart, easing) {
                    if (chart.config.options.showPieceLabel && chart.config.options.showPieceLabel.enabled === true) {
                        var self = chart.config;
                        var ctx = chart.ctx;
                        var decimal;
                        var fontSize;
                        var fontStyle;
                        var fontColor;
                        var fontFamily;
                        if (chart.config.options.showPieceLabel.fontSize) fontSize = parseInt(chart.config.options.showPieceLabel.fontSize);
                        else fontSize = 18;
                        if (chart.config.options.showPieceLabel.fontFamily) fontFamily = chart.config.options.showPieceLabel.fontFamily;
                        else fontFamily = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
                        if (chart.config.options.showPieceLabel.fontStyle) fontStyle = chart.config.options.showPieceLabel.fontStyle;
                        else fontStyle = "normal";
                        if (chart.config.options.showPieceLabel.fontColor) fontColor = chart.config.options.showPieceLabel.fontColor;
                        else fontColor = "#fff";
                        if (chart.config.options.showPieceLabel.decimal) decimal = parseInt(chart.config.options.showPieceLabel.decimal);
                        else decimal = 0;

                        // ctx.fontStyle = fontStyle;
                        ctx.fillStyle = fontColor;
                        ctx.font = fontStyle + " " + fontSize + 'px '+ fontFamily;
                        ctx.textAlign = "center";
                        ctx.textBaseline = 'middle';

                        chart.data.datasets.forEach(function (dataset, datasetIndex) {
                            var total = 0, //total values to compute fraction
                                labelxy = [],
                                offset = Math.PI / 2, //start sector from top
                                radius,
                                centerx,
                                centery,
                                lastend = 0; //prev arc's end line: starting with 0

                            for (var i=0; i<dataset.data.length; i++) {
                                total += dataset.data[i];
                            }

                            //TODO needs improvement
                            var i = 0;
                            var meta = chart.getDatasetMeta(datasetIndex);

                            var element;
                            for (var index = 0; index < meta.data.length; index++) {

                                element = meta.data[index];
                                radius = 0.9 * element.outerRadius - element.innerRadius;
                                centerx = element.x;
                                centery = element.y;
                                var thispart = dataset.data[index],
                                    arcsector = Math.PI * (2 * thispart / total);
                                if (element.hasValue() && dataset.data[index] > 0) {
                                    labelxy.push(lastend + arcsector / 2 + Math.PI + offset);
                                }
                                else {
                                    labelxy.push(-1);
                                }
                                lastend += arcsector;
                            }

                            var lradius;
                            if (self.type == "pie") {
                                lradius = radius * 3 / 4;
                            }
                            else if (self.type == "doughnut") {
                                lradius = radius * 1.8;
                            }

                            for (var idx in labelxy) {
                                if (labelxy[idx] === -1) continue;
                                var langle = labelxy[idx],
                                    dx = centerx + lradius * Math.cos(langle),
                                    dy = centery + lradius * Math.sin(langle),
                                    val = Math.round(dataset.data[idx] * (10 ** decimal) / total * 100) / (10 ** decimal);

                                if (!chart.config.options.showPieceLabel.mode) chart.config.options.showPieceLabel.mode = "value";
                                var mode = chart.config.options.showPieceLabel.mode.toLowerCase();    //value,percentage,label
                                if (mode == "percentage") {
                                    ctx.fillText(val + '%', dx, dy);
                                } else if (mode == "label") {
                                    ctx.fillText(chart.config.data.labels[idx], dx, dy);
                                } else if (mode == "percentage(value)") {
                                    ctx.fillText(val + '% ('+dataset.data[idx]+')', dx, dy);
                                } else {
                                    ctx.fillText(dataset.data[idx], dx, dy);
                                }

                            }
                            ctx.restore();
                        });
                    }
                }
            });

            if(this.cType === undefined){
                this.cType = "";
            }
            var uType = this.cType.toUpperCase();
            if(this.oldType !== uType && this.oldType !== ""){
                this.oldType = uType;
                this.data = "";
                this.options = "";
            }

            if (this.data == '' || this.data === undefined || this.data === null) {
                if(this.cType === undefined){ this.cType = ""; }
                //var uType = this.cType.toUpperCase();
                if (uType == 'BAR') {
                    this.data = {
                        "labels": [],
                        "datasets": [{
                            "label": "",
                            "data": []
                        }]
                    }
                } else if (uType == 'LINE' || uType == 'RADAR') {
                    this.data = {
                        "labels": [],
                        "datasets": [
                            {
                                "label": "",
                                "data": []
                            }
                        ]
                    }
                } else if (uType == 'POLARAREA' || uType == 'PIE' || uType == 'DOUGHNUT') {
                    this.data = {
                        "labels": [],
                        "datasets": [
                            {
                                "label": "",
                                "data": [],
                                "borderWidth": 2,
                            }
                        ]
                    }
                } else {
                    console.warn("Please enter type.");
                    return;
                }
            }


            if (this.data != '' && this.data != undefined && this.data !== null) {
                var typeList = [ 'bar', 'horizontalBar', 'line', 'radar','polarArea', 'pie', 'doughnut' ]; // horizontalBar 추가가능
                if(typeList.indexOf(this.cType) >= 0){
                    if (this.chartObj !== null && this.chartObj !== undefined && this.chartObj !== '') {
                        this.chartObj.destroy();            // HTMLCanvasElement 초기화
                    }

                    this.ychart.width  = this.width;
                    this.ychart.height = this.height;
                    // console.log(this.ychart.width, this.ychart.height);

                    var _type = this.cType;
                    var _ctx = this.ychart.getContext('2d',{willReadFrequently: true});
                    var _data = $.extend(true,{},this.data);
                    var _options = $.extend(true,{},this.options);
                    // console.log('_type',_type);
                    // console.log('_ctx',_ctx);
                    // console.log('_data',_data);
                    // console.log('_options',_options);

                    var _chart = new Chart(_ctx,{
                        type: _type,
                        data: _data,
                        options: _options
                    });
                    this.chartObj = _chart;
                    // console.log(_chart);
                    var cData = _ctx.getImageData(0 ,0 , this.ychart.width, this.ychart.height);
                    // console.log('----------------------------------------execDraw',cData);
                    aCtx.putImageData(cData, this.left, this.top);
                }
                else {
                    console.error('type error. \nPlease enter type [ bar, line, radar,polarArea, pie, doughnut ]');
                }
            } else {
                console.warn('Please enter data.');
            }
        }
    };
    $waiReport.core.addComponentBase(YRCompBase);
})();
