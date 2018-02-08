
debug = false;

function emptyf(){};

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
	
	init : function(){
		//App.sendMessage('updateIcon',{type:'open'});
		/*addEventListener("unload", function (event) {
			App.sendMessage('updateIcon',{type:'close'});
		}, true);	*/
		App.loadSettings()
		.then(App.getTabsCount)
		.then(App.renderInterface)
		.then(App.attachEvents)
		.then(App.getStatus)
		.then(function(status){
			browser.runtime.onMessage.removeListener(App.executeAction);
			browser.runtime.onMessage.addListener(App.executeAction);
				if (debug){
					console.log("Popup received status");
					console.log(status);
				}
			App.statusElText(status.text);
			switch (status.action){
				case 'ready':
					break;
					
				default:
					App.downloadButton.text('cancel');
					break;
				
				
			}
			App.disableDlIfNeeded();
			//$('.logo h1').text("Image Pirate");
			$('.content').css('visibility','visible')
		})
	},
	
	disableDlIfNeeded : function(){
		
			if (App.downloadButton.text()=='cancel'){
				return;
			}
			
			var rad = $('.radio-flex .flex-item input:checked').val();
				if ( rad=='left' && !App.tabsLeftCount || ( rad=='right' && !App.tabsRightCount) ){
					App.downloadButton.addClass('disabled');
				}else{
					if ( App.status.action=='ready' ){
						App.downloadButton.removeClass('disabled');
					}
				}
		
	},
	
	attachEvents : function(){
		return new Promise(function(resolve, reject){
			App.downloadButton = $('#downloadButton');
			$('.radio-flex .flex-item').on('click', function(){
				$(this).find('input').prop('checked',true);
				App.disableDlIfNeeded();
				App.saveQuickSettings();
			})
			
			
			$('.content input').each(function(){
				$(this).on('change',App.saveQuickSettings);
			})
			
			var rad = $('.radio-flex .flex-item:checked').val();
			
		
			$('#parralelDownloads,#maxRetries').on('input',function(){
				this.value = this.value.replace(/[^0-9]/ig,'');
			});
			
			
			$('#destFolder').on('input',function(){
				this.value = this.value.replace(/[\<\>\:\"\/\\\|\?\*]/ig,'');
				//this.value = this.value.replace(/[\?\*]/ig,'');
			});
			var duration = 0;
			var cClass = 'clicked';
			var sButton = $('.spoiler-button');
			var spoiler = $('.spoiler');
	
			$(sButton).off('click').on('click', function(){
				if ( !$(sButton).hasClass(cClass) ){
					spoiler.show();
					sButton.addClass(cClass);
				} else{
					spoiler.hide();
					sButton.removeClass(cClass);
				}
			})
			
			$('.show-downloads').on('click', function(){
				App.sendMessage('showDownloads');
			});
			
			App.downloadButton.on('click', function(){
				App.startDownload();
			});
			resolve();
		});

	
	},
	
	statusElText : function(txt,color){
		$('#status').removeClass('red');
		if (typeof color!="undefined"){
			$('#status').addClass(color);
		}
		$('#status').html(txt);

	},
	
	startDownload : function(){
		
		if ( App.downloadButton.hasClass('disabled') ){
			return;
		}
		
		if ( App.downloadButton.text()=='cancel' ){
			//App.dlButton.text('download');
			App.sendMessage('cancelDownloads');
			App.downloadButton.addClass('disabled');
			return;
		}else{
			App.downloadButton.text('cancel');	
		}
		
		
		$('#mobileLoader').addClass('visible');
		App.saveQuickSettings().then(function(){
			App.sendMessage('startDownload').then(function(){
				//window.close();	
			});
		});
	},
	
	tabsLeftCount:0,
	tabsRightCount:0,
	
	getTabsCount : function(){
		return new Promise(function(resolve, reject){
			App.sendMessage('getTabs').then(function(data){
				if (debug){
					console.log('Popup received tabs count');
					console.log(data);
				}
				App.tabsLeftCount = data.tabsLeftCount;
				App.tabsRightCount = data.tabsRightCount;
				$('#leftTabsCount').text('['+data.tabsLeftCount+']');
				$('#rightTabsCount').text('['+data.tabsRightCount+']')
				resolve();
			});
			
		})
	},
	
	loadSettings : function(){
		return new Promise(function(resolve, reject){
			App.sendMessage('getSettings').then(
			function(data){
				App.settings = data.settings;
				resolve();
				if (debug){
					console.log("Popup set settings");
					console.log(App.settings);
				}
			});
		});
	},
	
	saveQuickSettings : function(){
		return new Promise(function(resolve, reject){
			var settings={};
			settings.downloadPath =  $('#destFolder').val();
			if ( $('#leftRadioTab')[0].checked ){
				settings.whichTabs = 'left';
			}else if ($('#activeRadioTab')[0].checked){
				settings.whichTabs = 'active';
			}else{
				settings.whichTabs = 'right';
			}
			
			var minL=$('#minSizeLandscape').val();
			var minP=$('#minSizePortrait').val();
			var reg = new RegExp(/^[0-9]+x[0-9]+$/i);
			
			var wxh=(reg.test(minL)? minL.split('x'): [0,0]);
			settings.minSizeLandscape = {};
			settings.minSizeLandscape.width = Number(wxh[0]);
			settings.minSizeLandscape.height = Number(wxh[1]);
			
			wxh = (reg.test(minP)? minP.split('x'): [0,0]);
			settings.minSizePortrait = {};
			settings.minSizePortrait.width = Number(wxh[0]);
			settings.minSizePortrait.height = Number(wxh[1]);
			var par=$('#parralelDownloads').val();
			if (par=='' || !$.isNumeric(par)){
				par=0;
			}
			settings.parralelDownloads = Number(par);
			
			var par = $('#maxRetries').val();
			if (par =='' || !$.isNumeric(par)){
				par = 0 ;
			}
			settings.maxRetries = Number(par);
			
			settings.onlyLargestImage = $('#onlyLargestCheck')[0].checked;
			settings.closeTabs = $('#closeTabsCheck')[0].checked;
			settings.autoOpenDownloads = $('#autoOpenDownloadsCheck')[0].checked;
			
			
			App.sendMessage('updateSettings',{settings}).then(resolve);
		});
		
	},
	
	getStatus : function(){
		return new Promise(function(resolve, reject){
			App.sendMessage('getStatus').then(function(data){
				App.status = data.status;
				resolve(data.status);
			})	
		});
	},
	
	
	renderInterface : function(){
		return new Promise(function(resolve, reject){				
			$('#destFolder').val(App.settings.downloadPath); 
			$('#'+App.settings.whichTabs+'RadioTab')[0].checked = true;
			$('#minSizeLandscape').val(App.settings.minSizeLandscape.width+'x'+App.settings.minSizeLandscape.height);
			$('#minSizePortrait').val(App.settings.minSizePortrait.width+'x'+App.settings.minSizePortrait.height);
			$('#parralelDownloads').val(App.settings.parralelDownloads);
			$('#maxRetries').val(App.settings.maxRetries);
			$('#onlyLargestCheck')[0].checked = App.settings.onlyLargestImage;
			$('#closeTabsCheck')[0].checked = App.settings.closeTabs;
			$('#autoOpenDownloadsCheck')[0].checked = App.settings.autoOpenDownloads;
			resolve();
		})
	},
	
	status:{},
	
	executeAction : function (message, sender, sendResponse){
		var action = message.action;
		var data = message.data;
		if (debug){
			console.log("Recived message popup");
			console.log(message);
		}
		switch (action){
			case 'setStatus': 
				App.statusElText(data.text);
				App.status = data;
				if (data.action=='ready'){
					App.downloadButton.text('download');
					$('#mobileLoader').removeClass('visible');
					App.getTabsCount()
					.then(App.disableDlIfNeeded)
				}
				
				break;
				
		}
	}
}

App.init();















