
debug = false;

var App = {
	settings:{},
	
	sendMessage : function(action,data){
		return new Promise(function(resolve, reject){
			if (typeof data=='undefined'){
				data={};
			}
			browser.runtime.sendMessage({
				'action':action,
				'data':data
			}).then(resolve);
			
		});
	},
	
	links : [],
	
	init:function(){
		App.links = getSelectedHTML();
		browser.runtime.onMessage.removeListener(App.executeAction);
		browser.runtime.onMessage.addListener(App.executeAction);
	},
	
	executeAction : function (message, sender, sendResponse){
		var action = message.action;
		var data = message.data;
		if (debug){
			console.log("Recived message parse links");
			console.log(message);
		}
		switch (action){
			case 'sendLinksBack': 
				var sendData={"needDownload":false,links:App.links};
				if ( data.needDownload ){
					sendData.needDownload = true
				}
				sendResponse(sendData);
				//App.sendMessage("openTabs",sendData);
				break;
				
		}
	}	
	
	
}

App.init();


function cloneToDiv(el){
	var div = document.createElement('DIV');
	div.appendChild(el);
	return div;
}

function isLinkOk(link){
	if (link.href==undefined){
		return false;
	}
	
	var link = link.href.toLowerCase();
	
	if ( link=='' || link.startsWith('javascript')
	|| link==location.href || link==location.href+'#' ){
		return false;
	}
		
	return true;
}

function getSelectedHTML() {
        var range = window.getSelection ? window.getSelection() : null;
		
        if (range) {
			if (range.getRangeAt) {
				range = range.getRangeAt(0);
			}
			
			var div;
			
			if (range.startContainer.href!==undefined 
			&& range.endContainer.href!==undefined && range.startContainer.href==range.endContainer.href){
				div = cloneToDiv(range.startContainer.cloneNode(false));
			}else{
				div = cloneToDiv(range.cloneContents());
			}
			//console.log(range);
            var links = div.getElementsByTagName("A")
			
			var linksHrefs = [];
            for (var i=0; i < links.length; i++) {
				if ( !isLinkOk(links[i]) ){
					continue;
				}
				
				var l = links[i].href;
				if (linksHrefs.indexOf(links[i].href)==-1){
					linksHrefs.push(links[i].href);
				}
            }
			if (linksHrefs.length){
				return linksHrefs;
			}
		}
		return false;
}
