$waiCompuserInfo = {};

(function(){
    var ComponentPath = '/wai/comp_user';
    var LoadSequence = ["mybtn","mycomp","myinput"];
    var ComponentInfo = {"mybtn":{"enabled":true,"CSSs":["mybtn\/mybtn.css"],"args":{"debug":"debug"},"path":"mybtn\/mybtn.wjs","ver":"1.0"},"mycomp":{"enabled":true,"CSSs":[],"args":{"debug":"debug"},"path":"mycomp\/mycomp.wjs","ver":"1.0"},"myinput":{"enabled":true,"CSSs":[],"args":{"debug":"debug"},"path":"myinput\/myinput.wjs","ver":"1.0"}};


    $waiCompuserInfo['ComponentPath']= ComponentPath;
    $waiCompuserInfo['LoadSequence'] = LoadSequence;
    $waiCompuserInfo['ComponentInfo'] = ComponentInfo;
})();

