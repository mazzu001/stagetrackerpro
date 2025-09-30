$waiRepCompInfo = {};
(function(){
    var ComponentPath = '/component';
    var LoadSequence = [
        'default',
        'label',
        'textbox',
        'line',
        'shape',
        'image',
        'checkbox',
        'rtf',
        'subReport',
        // 'barcode',
        // 'qrcode',
        'chartSrc',
        'chart'
    ];
    var ComponentInfo = {
        'default' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : '_default.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'label' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'label.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'textbox' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'textbox.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'line' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'line.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'shape' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'shape.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'image' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'image.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'checkbox' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'checkbox.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'rtf' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'rtf.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'subReport' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'subReport.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'barcode' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'barcode.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'qrcode' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'qrcode.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'chartSrc' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'chart/chartjs.min.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
        ,'chart' : {
            cache : 'core',
            ver   : '1.0.0',
            path  : 'chart/chart.js',
            CSSs  : [],
            args  : {'debug':'debug'}}
    };

    $waiReport.components.path = $waiReport.info.path + ComponentPath;
    $waiReport.components.loadSequence = LoadSequence;
    $waiReport.components.loadInfo = ComponentInfo;
})();