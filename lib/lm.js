var app = false;
var serverPath;
var services={};
var map,sWidth, sHeight,bestWidth, panorama;
var mainOverlay={markers:{}, layers:{}};
var mainData={dir:{origin:"",dest:"" }};
var userPosition={};
var tapHold;
var date = new Date();
var colourMatrix = {
	light : ['#FF4242','#FF42D9','#BC57FF','#577EFF','#57E0FF','#59FFB4','#5FFF4A','#EDFF4A','#FFC43B'],
	normal : ['#FF0000','#FF00CC','#9900FF','#003CFF','#00D0FF','#00FF8C','#1EFF00','#E5FF00','#FFB300'],
	dark : ['#AD0000','#BA0095','#7000BA','#0027A6','#008EAD','#00A85D','#15B000','#ACBF00','#C28800']
};

var servicesList = {
	bixi:{
		toronto:{tag:"toronto", color:"#0073ff"},
		montreal:{tag:"montreal", color:"#0073ff"},
		ottawa:{tag:"ottawa", color:"#0073ff"}
	},
	nextbus:{
		toronto:{tag:"ttc", color:"#CC0000"},
		laval:{tag:"stl", color:"#0053a6"},
		sherbrooke:{tag:'sherbrooke', color:"#c5e23f"},
		thunder_bay:{tag:"thunderbay", color:"#065c88"}
	},
	c2g:{
		toronto:{tag:"Toronto", color:"#009fe4"},
		montreal:{tag:"Montreal", color:"#009fe4"}
	},
	go:{
		toronto:{tag:"toronto", color:"#0073ff"}
	}
};
var currentCity;
var listeners={};
function init(){
	var firstTime = false;

	if(typeof localStorage.firstTime2=="undefined"){localStorage.removeItem("services");localStorage.firstTime2=false;}

	serverPath = 'http://';
	if(typeof localStorage.currentCity!="undefined"){currentCity = localStorage.currentCity;}
	drawMap();


	if(app===false){serverPath+=document.domain;}
	else{
		serverPath+='www.local-motion.ca';
		document.addEventListener("deviceready", function(){
			try
			{
				navigator.splashscreen.hide();
			}
			catch(err)
			{
				alert(err);
			}
		}, false);
	}

	setDim();
	if(typeof localStorage.services ==="undefined"){
		firstTime = true;
			$('#content').css('max-height', sHeight);
			$('#content').load('components.html #config', function(){
				$(this).trigger('create').slideDown();
			});
			return false;
	}

	$.each(JSON.parse(localStorage.services), function(i, service){
		if(service=='nextbus' && typeof services[service]==="undefined"){nextbusService();}
		if(service=='bixi' && typeof services[service]==="undefined"){ bixiService();}
		if(service==='c2g' && typeof services[service]==="undefined"){ c2gService();}
		if(service==='go' && typeof services[service]==="undefined"){ goService();}
	});
	$('#config, #content').slideUp()

	drawNavBar();
	news.getData();
	getPosition(function(){centerMap();initLoc();});
	user.getInfo();
	if(defined(localStorage.startup)!=="" && localStorage.startup=="dash" && firstTime == false){showDash();}
	$.mobile.loadPage('components.html', { showLoadMsg: false } );
	if (typeof localStorage.currentService!="undefined"){changeService(localStorage.currentService);}
	else{
		$.each(services, function(i, service){changeService(service.name); return false;});
	}

	function drawNavBar(){
		var btns = [];
		var length =Object.keys(services).length;
		var width= (100-10)/length;
		btns.push({
			content: '<div data-action="open" data-target="panel" class="btn btn-icon width100"><div class="icon bars '+imgRes.lm() +' marginsAuto"></div></div>',
			divAttr:'style="width:10%;"'
		});
		$.each(services, function(i, service){
			btns.push({
				content: jqFactory.button(service.screenName,{
							classes:'margin0',
							attr:'data-target="'+service.name+'"'
				}),
				divAttr: 'style="width:'+width+'%"'
			});
		});
		$('#footer').html(jqFactory.grid(btns)).fadeIn();
	}

}
function initLoc(){
	//services[localStorage.currentService].initLoc();
};
function loadConfig(){
	$('#content').load('components.html #config', function(){
		openContent();
		$(this).trigger('create').slideDown();
		$('#config fieldset').show();
		$('#config h1').html("Settings");
		if(typeof localStorage.startup!="undefined"){
			$('#startup').val(localStorage.startup);
			$('#startup').slider('refresh');
		}
		if(typeof localStorage.imgRes!="undefined"){
			$('#imgRes').val(localStorage.imgRes);
			$('#imgRes').slider('refresh');
		}
	});
}
function config(){
	var services2=[];
	$.each($('#config ul[data-name="services"] a.ui-btn-active'), function(i, value){services2.push($(this).attr('data-name'));});
	localStorage.currentCity = $('#config select[data-name="city"]').val();
	currentCity = localStorage.currentCity;
	localStorage.services=JSON.stringify(services2);
	services={};
	localStorage.startup=$('#startup').val();
	localStorage.imgRes=$('#imgRes').val();
	$('#content').css('max-height', sHeight*0.75);
	init();
}
function setDim(){
	sWidth = $(window).width();
	if(sWidth<=600){bestWidth=sWidth-30;}else{bestWidth=600;}
	if (sWidth<=600){
		sHeight =  $(window).height() - $('.ui-footer').height() + 7;}
	else
	{
		sHeight = $(window).height();
	}
	$("#map, .ui-panel-inner").height(sHeight);
	$('#content, #alert').width(sWidth-6);
	$('.maxHeight75').css('max-height', sHeight*0.75);
	$('.maxWidth').css('max-width', '600px');

	if(map){google.maps.event.trigger(map, "resize");}
}
function drawMap(){
	var location = new google.maps.LatLng("43.653226", "-79.383184");
	var style = [
	{
		"featureType": "transit.station.bus",
		"stylers": [
			{ "visibility": "off" }
		]
	},{
		"featureType": "transit.station",
		"stylers": [
			{ "visibility": "off" }
		]
	},{
		"featureType": "poi",
		"stylers": [
			{ "visibility": "off" }
			]
	}];
	var mapOptions = {
	center: location,
	disableDefaultUI: true,
	zoom: 16,
	mapTypeId: google.maps.MapTypeId.ROADMAP,
	styles: style
	};
	map = new google.maps.Map($("#map").get(0), mapOptions);
	new LongPress(map, 500);
    google.maps.event.addListener(map, 'longpress', function(e) {
    	console.log(e);
		$('#clickOverlay a[data-action="dirTo"]').attr('data-target', e.latLng.k + ","+e.latLng.A);
		$('#clickOverlay a[data-action="dirFrom"]').attr('data-target', e.latLng.k + ","+e.latLng.A);
		$('#clickOverlay').css('top', e.pixel.y);
		$('#clickOverlay').css('left', e.pixel.x);
		$('#clickOverlay').fadeIn();
    });
}
function searchPlaces (cb){
    function drawMap(places){
        $.mobile.loading('show');
        services[localStorage.currentService].clearMap.all();
        mainOverlay.markers.places=[];
        var icon, content;

        $.each(mainData.places, function(index, value){

            content= '<div data-action="dirTo" data-target="'+value.vicinity+'" data-index="'+index+'" class="textMarker">'+value.name+'</div>';

            mainOverlay.markers.places.push(new RichMarker({
                position: value.geometry.location,
                draggable: false,
                clickable: true,
                flat:true,
                anchor: RichMarkerPosition.BOTTOM_LEFT,
                content: content,
                map : map
                })
            );
        });
        $.mobile.loading('hide');
    }

    function drawList(){
        var target = $("#searchResults [name='results'] ul");
        $.mobile.loading('show');
        var text="";
        var distance = "";

        $.each(mainData.places, function(index, place){
            if (typeof place.distance !="undefined"){distance = " ("+place.distance + " km)";}

        	text +=jqFactory.li(place.vicinity+distance,
				{header:place.name, btn:true, btnClass:"content ui-icon-arrow-r", btnAttr:'data-action="getDirectionsTo" data-target="'+place.vicinity+'" data-index="'+index+'"',});

        });
        target.html(text).listview().listview('refresh');
        $.mobile.loading('hide');
    }

    $.mobile.loading('show');

    var keyword = $("#search input").val();
    var request = {
        location: map.getCenter(),
        radius: 500,
        keyword: keyword
    };

    var search = new google.maps.places.PlacesService(map);
    search.nearbySearch(request, function(results, status){
        if (typeof userPosition.lat !=="undefined"){
            var userLocation  = new google.maps.LatLng(userPosition.lat, userPosition.lng);
            $.each(results, function (i, place){
                results[i].distance = google.maps.geometry.spherical.computeDistanceBetween (userLocation, place.geometry.location);
                results[i].distance = Math.round(place.distance/1000* 10 ) / 10;
            });
            results.sort(function(a,b) {
                return a.distance - b.distance;
            });
        }
        mainData.places = results;
        drawMap();

        drawList();
        $("#searchResults").slideDown();
        $.mobile.loading('hide');
    });
}
function loadDir(cb){
	$('#content').load('components.html #dir', function(){
		if(mainData.dir.origin!=""){$('#dir input[name="from"]').val(mainData.dir.origin)};
		$('#dir input[name="to"]').val(mainData.dir.dest);
		openContent();
		$(this).trigger('create').slideDown();
		if(typeof cb!="undefined"){cb()};
	});
}
function showDash(){

	$('#content').html(
			'<div data-role="header">\
				<h1>Dash</h1>\
				<button class="ui-btn-right ui-btn ui-btn-inline ui-mini ui-corner-all ui-btn-icon-right  ui-icon-delete ui-btn-icon-notext ui-nodisc-icon">Close</button>\
			</div>')
	if(typeof userPosition.lat ==="undefined"){
		getPosition(function(){
			$.each(services, function(i, service){
				$('#content').append('<ul data-role="listview" data-module="'+service.name+'"></ul>')
				service.dash();
			});
			openContent();
			$('#content').trigger('create').slideDown();
			});
	}
	else{
		$.each(services, function(i, service){
			$('#content').append('<ul data-role="listview" data-module="'+service.name+'"></ul>')
			service.dash();
		});
		openContent();
		$('#content').trigger('create').slideDown();
	}
}
function showHelp(){
	$('#content').load('components.html #help', function(){
		openContent();
		$(this).trigger('create').slideDown();
	});
}
function showApps(){
	$('#content').load('components.html #apps', function(){
		openContent();
		$(this).trigger('create').slideDown();
	});
}
function getPosition(cb){
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            userPosition.lat = position.coords.latitude;
            userPosition.lng = position.coords.longitude;

            if(typeof cb!="undefined"){cb()};
        },
        function(error) {
            switch(error.code)
            {
            case error.PERMISSION_DENIED:
                alertMsg("User denied the request for Geolocation.", 'long');
                break;
            case error.POSITION_UNAVAILABLE:
                alertMsg("Location information is unavailable.", 'long');
                break;
            case error.TIMEOUT:
                alertMsg("The request to get user location timed out.", 'long');
                break;
            case error.UNKNOWN_ERROR:
                alertMsg("An unknown error occurred.", 'long');
                break;
            }
            $('[data-action="getPosition"]').removeClass('flash');
            //if(typeof cb!="undefined"){cb()};
        },{
            enableHighAccuracy: true,
            timeout:10000
        });
    }
    else {
        alertMsg("Geolocation not supported.", 'long');
        if(typeof cb!="undefined"){cb()};
    }
}
function refresh(){
	$.each(mainOverlay.markers, function(i, array){if(i!="person"){clearMarker(array);}})
	services[localStorage.currentService].clearMap.all();
	services[localStorage.currentService].init();
}
function centerMap (){
    var location;
    if (typeof userPosition.lat ==="undefined"){
        return false;
    }

    location = new google.maps.LatLng(userPosition.lat, userPosition.lng);
    if (typeof mainOverlay.markers.person !="undefined"){mainOverlay.markers.person.setMap(null);}

    map.panTo(location);

    mainOverlay.markers.person = new google.maps.Marker({
        position: location,
        map: map,
        animation: google.maps.Animation.DROP,
        icon: 'img/personMarker.png',
        zIndex:100
    });
}

function setLayers(element){
    $('.ui-panel').panel('close');
    if(element.hasClass('ui-btn-active')===true){
        element.removeClass("ui-btn-active");
        if(typeof mainOverlay.layers !=="undefined"){
            if(element.attr('data-target')=="bikeLanes"){
                    if(typeof mainOverlay.layers.bikeLanes !=="undefined"){mainOverlay.layers.bikeLanes.setMap(null);}
            }
            else if(element.attr('data-target')=="traffic"){
                    if(typeof mainOverlay.layers.traffic !=="undefined"){mainOverlay.layers.traffic.setMap(null);}
            }
        }
    }
    else{
        if(element.attr('data-target')=="bikeLanes"){
            mainOverlay.layers.bikeLanes =  new google.maps.BicyclingLayer();
        mainOverlay.layers.bikeLanes.setMap(map);
        }
        else if(element.attr('data-target')=="traffic"){
            mainOverlay.layers.traffic =  new google.maps.TrafficLayer();
        mainOverlay.layers.traffic.setMap(map);
        }

        element.addClass("ui-btn-active");
    }
}
function changeService(service){
	if(typeof services[localStorage.currentService]!=="undefined"){services[localStorage.currentService].clearMap.all();}
	localStorage.currentService=service;
	services[service].init();
	$('#footer button').removeClass("borderb2 borderBlue");
    $('#footer button[data-target="'+localStorage.currentService+'"]').addClass("borderb2 borderBlue");
    $('[data-module]').not($('#dash [data-module]')).hide();
    $("[data-module='"+localStorage.currentService+"']").show();
    if(localStorage.currentCity=="toronto"){
    	$("[data-module='ttc']").show();
    }
}
function openContent(){
	$( "#content" ).animate({
		opacity: 1
	}, 500);
	$( "#content" ).css('height', 'auto');
	$( "#content" ).slideDown();
}
function minContent(){
	if($('#content').is(':visible')===true && $('#content').is(':animated')===false){
		if($('#content').height()!=42){$( "#content" ).attr('data-height',$( "#content" ).height());};
		$('#content').scrollTop(0)
		$( "#content" ).animate({
			opacity: 0.5,
			height: $( "#content [data-role='header']" ).height()
		}, 500);

	}
}
function closeContent(){
	$('#content').slideUp('fast', function(){
		$('#content').css('height', 'auto').css('opacity',1);
		if(typeof panorama !=='undefined' && typeof panorama.visible !=='undefined'){panorama.setVisible(false);}
	});
}
function showStreetView(latLng, heading, pitch, index) {
	if(heading ===""){heading =0;}
	if(pitch ===""){pitch =0;}

	var panoOptions = {
		position: latLng,
		pov: {
			heading: heading,
			pitch:pitch
		},
		addressControlOptions: {
			position: google.maps.ControlPosition.BOTTOM
		},
		linksControl: false,
		zoomControlOptions: {
			style: google.maps.ZoomControlStyle.SMALL
		},
		enableCloseButton: false,
		visible:true
		};

		 panorama = new google.maps.StreetViewPanorama($("#content [data-name='img']").get(0), panoOptions);

		$('[data-action="saveView"]').css('display', 'inline-block');
		$('[data-action="streetView"]').hide();
};
function user(){
	this.data={};
	var parent = this;
	this.checkUser = function(){
		if (typeof localStorage.email ==='undefined'){
			$("[data-module='user']").hide();
			$("[data-module='nouser']").show();
		}
		else{
			$("[data-module='user']").show();
			$("[data-module='nouser']").hide();
		}
	}
	this.reg = function(){
		var email = encodeURIComponent($("#account [name='email']").val());
		var password = encodeURIComponent($("#account [name='password']").val());
		var query;
		$.mobile.loading('show');
		if (email==="undefined" || password==="undefined"){
			alertMsg("You must enter both an email address and a password.");
			$.mobile.loading('hide');
			return false;
		}
		if (email==="" || password===""){
			alertMsg("You must enter both an email address and a password.");
			$.mobile.loading('hide');
			return false;
		}

		query = serverPath+ "/server/user.php?command=register";
		$.post( query, {email:email, password:password}, function(data){
			if(data.indexOf("Success")>-1){
				localStorage.setItem("email", decodeURIComponent(email));
				$.mobile.loading('hide');
				user.getInfo();
				$('#account [data-name="reg"]').slideUp();
				alertMsg("You\'re now registered!");
				$('#content').slideUp();
			}
			else if(data.indexOf("Existing")>-1){
				$.mobile.loading('hide');
				alertMsg("Your email is already registered.");
				$('#account [data-name="wrongLogin"]').slideDown();
				//flash($('#account [data-name="wrongLogin"]'),'medium');
			}

		}).fail(function(xhr, status, error){
			alertMsg("Something wrong with getting data from the server.");
		});
	};
	this.login = function(){
		var email = encodeURIComponent($("#account [name='email']").val());
		var password = encodeURIComponent($("#account [name='password']").val());
		var query;
		$.mobile.loading('show');
		if (email==="undefined" || password==="undefined"){
			alertMsg("You must enter both an email address and a password.");
			$.mobile.loading('hide');
			return false;
		}
		if (email==="" || password===""){
			alertMsg("You must enter both an email address and a password.");
			$.mobile.loading('hide');
			return false;
		}

		query = serverPath+ "/server/user.php?command=login";
		console.log(password);
		$.post( query, {email:email, password:password}, function(data){
			console.log(data);
			if (data=="no_results"){
				alertMsg("Either your username or password is incorrect.");
				$('#account [data-name="wrongLogin"]').slideDown();
				$.mobile.loading('hide');
				return false;
			}
			localStorage.setItem("email", decodeURIComponent(email));
			$.mobile.loading('hide');
			user.getInfo();
			$('#account [data-name="reg"]').slideUp("fast");
			$('#content').slideUp();
		}).fail(function(xhr, status, error){
			alertMsg("Something wrong with getting data from the server.");
		});
	};
	this.getInfo = function(cb){
		if(localStorage.email){
			var email = encodeURIComponent(localStorage.email);
			var query = serverPath+ "/server/user.php?command=getInfo&email="+email;
			$.get( query, function(result){
				if (result=="no_results"){
					localStorage.removeItem("email");
					parent.checkUser();
					$.mobile.loading('hide');
					return false;
				}
				result = $.parseJSON(result);
				localStorage.c2gAccount=result.c2gAccount;
				$("[data-module='user']").slideDown();
				$("[data-module='nouser']").slideUp();
				$.mobile.loading('hide');
				if(typeof cb !=="undefined"){cb();}
			}).fail(function(xhr, status, error){
				alertMsg("Something wrong with getting data from the server.");
				if(typeof cb !=="undefined"){cb();}
			});
		}
		else{
			localStorage.removeItem("email");
			parent.checkUser();
			$.mobile.loading('hide');
		}
	};
	this.showAccount = function(){
		$('#content').load('components.html #account', function(){
			parent.checkUser();
			if(typeof services.c2g ==="undefined"){$('#account [data-module="c2g"]').hide();}
			else{$('#account [data-module="c2g"]').show();$('#account iframe').attr('src', 'http://www.local-motion.ca/server/oauth/oauth.php?email='+localStorage.email);}
			$(this).trigger('create');
			openContent();
		});
	};
	this.showBoard = function(){
		$('#content').load('components.html #board', function(){
			parent.getBoard();
			$('#board [data-module]').not($('#board [data-module="'+localStorage.currentService+'"]')).hide();
			openContent();
			$(this).trigger('create').slideDown();
			parent.checkUser();
		});
	};
	this.postBoard = function(){
		var comment = encodeURIComponent($("#board [name='comment']").val());
		var type = $('#board [data-type].ui-btn-active').attr('data-type');
		var query = serverPath+ "/server/user.php?command=postBoard";
		var tag;

		if (comment==="undefined" || comment===""){
			alertMsg("You must enter a comment to post.");
			$.mobile.loading('hide');
			return false;
		}

/*		if(type=='location'){
			tag =
		}*/
		$.post( query, {comment:comment, email:localStorage.email}, function(data){
			if(data.indexOf("Success")>-1){
				parent.getBoard();
				$("#board [name='comment']").val("");
			}

		}).fail(function(xhr, status, error){
			alertMsg("Something wrong with posting your comment.");
		});
	};
	this.getBoard = function(){
		var query = serverPath+ "/server/user.php?command=getBoard";
	    $.getJSON( query, function(data){
	    	var output="";
	        $.each(data, function(index, comment){
				output +=jqFactory.li(comment.comment,
					{btn:true, btnClass:"content", btnAttr:'data-action="reply"', text2: comment.email + " @ " + comment.date});
	        });
	        parent.data.board=data;
	        $('#board ul').html(output).listview().listview('refresh');
	        $.mobile.loading('hide');
	        if(typeof cb!="undefined"){cb(parent.data.vehicleLocation,parent.overlays.mc )};
	    }).fail(function(xhr, status, error) {
	    	$.mobile.loading('hide');
	        alertMsg("Something wrong with getting data from the server.");
	    });
	}
	this.signout = function(){
		localStorage.clear();
		localStorage.email={};
		parent.getInfo();
	}
	this.passReset = function(){
	    var email = encodeURIComponent($("#account [name='email']").val());
	    var query = serverPath+ "/server/user.php?command=getPassword&email="+email;
	    $.mobile.loading('show');
	    $.get( query, function(data){
	            if(data.indexOf("Success")>-1){
	               alertMsg("You have been sent an email with instructions to reset your password.","medium");
	               $.mobile.loading('hide');
	            }
	            else{
	               alertMsg("Something went wrong while trying to reset your password.","medium");
	               $.mobile.loading('hide');
	            }
	        }).fail(function(xhr, status, error){
	        alertMsg("Something wrong with getting data from the server.", 'medium');
	        $.mobile.loading('hide');
	    });
	}
}
var user = new user();
function news(){
	var parent = this;
	this.getData = function(cb){
		var query = serverPath+ "/server/main.php?command=getNewsv31";
	    $.getJSON( query, function(result){
			mainData.news=result;
	        if(typeof cb!="undefined"){cb()};
	    }).fail(function(xhr, status, error){
	        alertMsg("Something wrong with getting data from the server.", 'medium');
	    });
	};
	this.writePanel = function(){

	};
	this.show = function(){
		var text;
		text = "<li>"+mainData.news[0].blog;
		text += "<span>" + mainData.news[0].date + '</span></li>';
		$('#content').html(jqFactory.content(mainData.news[0].header, text)).trigger('create');
        openContent();
        localStorage.news = mainData.news[0].id;
        $('#content li').addClass('content');
        $('#content li p').css('font-size', '1em');
	}
}
var news = new news();
function events(){
	{
		$( document ).on( "tap", 'a[data-toggle="true"]', function( e ) {$(this).toggleClass('ui-btn-active');});
		$( "#panel" ).panel({beforeopen: function( event, ui ) {$('#content').slideUp();}});
		$( document ).on( "tap", '#content', function( e ) {e.stopPropagation();});
		$( document ).on( "tap", '#home', function( e ) {minContent();});
		$( document ).on( "tap", '#content [data-role="header"]', function( e ) {
			if($(e.target).is(":button") === true){return false;}
			$( "#content" ).animate({
				opacity: 1,
				height: $( "#content" ).attr('data-height')
			}, 500);
		});
		$( document ).on( "tap", '#content [data-role="header"] button', function( e ) {
			closeContent();

		});
		$( document ).on( "tap", '[data-action="getPosition"]', function( e ) {getPosition(function(){centerMap();});});
		$( document ).on( "tap", '[data-action="routeDetails"]', function( e ) {
			if(localStorage.currentService=="nextbus"){
				services.nextbus.routeInfo($(this).attr('data-routetag'));
			}

	    });
	    $( document ).on( "tap", '[data-target="dash"]', function( e ) {showDash();});
	    $( document ).on( "tap", '[data-action="refresh"]', function( e ) {refresh();});
	    $( document ).on( "tap", '[data-action="showParking"]', function( e ) {services.c2g.getParking(services.c2g.drawParking);});
	    $( document ).on( "tap", '[data-action="zoomToStops"]', function( e ) {map.setZoom(18);});
	    $( document ).on( "tap", '[data-action="bingoFuel"]', function( e ) {services.c2g.bingoFuel();});
	    $( document ).on( "tap", '[data-action="stopInfo"]', function( e ) {
			e.stopPropagation();
			if($( "#content" ).height()==42){$( "#content" ).css('height','auto');}
			if(localStorage.currentService=="nextbus"){
				if(typeof $(this).attr('data-stopTag')!="undefined"){
					services.nextbus.stopInfo([{stopTag:$(this).attr('data-stopTag'), routeTag:$(this).attr('data-routeTag')}]);
				}
				else if(typeof $(this).attr('data-stopRouteTags')!="undefined"){
					var stopArr=$.parseJSON(decodeURIComponent($(this).attr('data-stopRouteTags')));
					services.nextbus.stopInfo(stopArr);
				}
			}
			else if(localStorage.currentService=="go"){
				services.go.stopInfo([$(this).attr('data-stopID')],$(this).attr('data-routeID'));
				}
	    });
	}//global
	{
		$( document ).on( "tap", '#config a[data-toggle="true"]', function( e ) {$(this).toggleClass('ui-icon-check ui-icon-delete ');});
		$( document ).on( "tap", '#config button[data-name="done"]', function( e ) {config();});
		$( document ).on( "tap", '#account button', function( e ) {
			if($(this).attr('data-action')=="register"){user.reg();}
			else if($(this).attr('data-action')=="login"){user.login();}
		});
		$( document ).on( "change", 'select[data-name="city"]', function( e ) {
			currentCity = $(this).val();

			$.each(servicesList, function(i,value){
				if(typeof value[currentCity]==="undefined"){
					$('[data-name="services"] a[data-name="'+i+'"]').removeClass('ui-btn-active');
					$('[data-name="services"] li[data-name="'+i+'"]').slideUp();
				}
				else{
					$('[data-name="services"] li[data-name="'+i+'"]').slideDown();
					$('[data-name="services"] a[data-name="'+i+'"]').addClass('ui-btn-active');
				}
			});
		});

	}//config
	{
		$( document ).on( "tap", '#board [data-action="post"]', function( e ) {user.postBoard();});
		$( document ).on( "tap", '#board [data-type]', function( e ) {$('#board [data-type]').not($(this)).removeClass('ui-btn-active');$(this).toggleClass('ui-btn-active');});
	}//board
	{
		$( document ).on( "tap", '#footer [data-target]', function( e ) {
			var target = $(this).attr('data-target');
			if(target=="panel"){$('#panel').panel('open'); return false;}
			changeService(target);
	    });
	}//footer
	{
		$( document ).on( "tap", '#panel ul[data-name="buttons"] a', function( e ) {
			$('#panel').panel('close');
			if($(this).attr('data-target')=="config"){loadConfig();}
			if($(this).attr('data-target')=="account"){user.showAccount();}
			if($(this).attr('data-target')=="board"){user.showBoard();}
			if($(this).attr('data-action')=="dir"){loadDir();}
			if($(this).attr('data-action')=="setLayers"){setLayers($(this));}
			if($(this).attr('data-action')=="showBookings"){services.c2g.bookings();}
			if($(this).attr('data-target')=="news"){news.show();}
			if($(this).attr('data-target')=="help"){showHelp();}
			if($(this).attr('data-target')=="apps"){showApps();}
			if($(this).attr('data-action')=="listRoutes"){services.go.listRoutes();}
	    });
	   	$( document ).on( "tap", '#panel [data-action="feedback"]', function( e ) {services.ttc.feedbackLoc($(this).attr('data-type'));});

	    $('#search input').bind('keyup', function(e) {
	        if(e.keyCode==13){
	        	$('#searchResults ul').html("");
	        	searchPlaces();
	        }
	        else if(e.keyCode!=13 && localStorage.currentService=="nextbus"){
	            if(parseInt($(this).val())!=NaN){
	                services.nextbus.searchAutocomplete();
	            }
	        }
	    });

	}//panel
	{
    	google.maps.event.addListener(map, 'mousedown', function(e) {
		    if($('#clickOverlay').css('opacity')==1){$('#clickOverlay').fadeOut()};
		});

		google.maps.event.addListener(map, 'idle', function() {
			if(map.getZoom()>17&& localStorage.currentService=="nextbus"){
				services["nextbus"].getStops(services["nextbus"].showStops);
			}
			else if(localStorage.currentService=="nextbus"){
				services["nextbus"].clearMap.stops();
			}
		});

	    $( document ).on( "tap", '[data-action="getVehicleInfo"]', function( e ) {
			e.stopPropagation();
			if($( "#content" ).height()==42){$( "#content" ).css('height','auto');}
			services[localStorage.currentService].getVehicleInfo($(this).attr('data-vID'));
	    });
	    $( document ).on( "tap", '[data-action="dirTo"]', function( e ) {
	    	var target = $(this).attr('data-target');
			e.stopPropagation();
			if($( "#content" ).height()==42){$( "#content" ).css('height','auto');}
			mainData.dir.dest = target;
			loadDir();
			if($('#clickOverlay').css('opacity')==1){$('#clickOverlay').fadeOut()};
	    });
	   	$( document ).on( "tap", '[data-action="dirFrom"]', function( e ) {
	    	var target = $(this).attr('data-target');
			e.stopPropagation();
			if($( "#content" ).height()==42){$( "#content" ).css('height','auto');}
			mainData.dir.origin = target;
			loadDir();
			if($('#clickOverlay').css('opacity')==1){$('#clickOverlay').fadeOut()};
	    });
	    $( document ).on( "tap", '[data-action="getDeets"][data-module="bixi"]', function( e ) {
	    	var index = $(this).attr('data-index');
			e.stopPropagation();
			if($( "#content" ).height()==42){$( "#content" ).css('height','auto');}
			services.bixi.getDeets(index);
	    });
	    $( document ).on( "tap", '[data-action="getDeets"]', function( e ) {
			e.stopPropagation();
			if($( "#content" ).height()==42){$( "#content" ).css('height','auto');}
	    	if($(this).attr('data-module')=="c2g"){
	    		services.c2g.carDeets([$(this).attr('data-index')]);
	    	}
	    });
	   	$( document ).on( "tap", '[data-action="subwayInfo"]', function( e ) {
			e.stopPropagation();
			if($( "#content" ).height()==42){$( "#content" ).css('height','auto');}
	    	services.ttc.subwayInfo([$(this).attr('data-stopID')]);

	    });

	}//map
	{
		$( document ).on( "tap", '#dir button', function( e ) {
			services[localStorage.currentService].dir.getDir();
	    });
	    $( document ).on( "tap", '#content [data-module="ttc"][data-action="feedback"]', function( e ) {
			services.ttc.feedback($(this).attr('data-type'), $(this).attr('data-VID'));
	    });
	    $( document ).on( "tap", '#content [data-action="streetView"]', function( e ) {
			services[localStorage.currentService].getStreetView($(this).attr('data-index'));
	    });
	   	$( document ).on( "tap", '#content [data-action="saveView"]', function( e ) {
			services[localStorage.currentService].saveView($(this).attr('data-index'));
	    });
	    $( document ).on( "tap", '#account [data-action="linkc2g"]', function( e ) {
			services.c2g.linkAccounts();
	    });
	    $( document ).on( "tap", '#account [data-action="signout"]', function( e ) {
			user.signout();
	    });
	    $( document ).on( "tap", '#account [data-action="passReset"]', function( e ) {
			user.passReset();
	    });
	    $( document ).on( "tap", '#content [data-action="createBooking"]', function( e ) {
			services.c2g.createBooking($(this).attr('data-vin'));
	    });
	    $( document ).on( "tap", '#content [data-action="cancelBooking"]', function( e ) {
			services.c2g.cancelBooking($(this).attr('data-bookingID'));
	    });
	    $( document ).on( "tap", '#content [data-action="getStarted"]', function( e ) {
			//showDash();
			$('#content').css('max-height', sHeight);
			$('#content').load('components.html #config', function(){
				$(this).trigger('create').slideDown();
			});
	    });
	    $( document ).on( "tap", '#content [data-action="toggleFavStop"]', function( e ) {
			services.nextbus.toggleFavStop($(this).attr('data-stopTag'));
	    });
	    $( document ).on( "change", '#goDateSelect', function( e ) {services.go.changeDateSlider(e.target.value);});
	    $( document ).on( "change", '#goTimeSelect', function( e ) {services.go.changeTimeSlider(e.target.value);});
	    $( document ).on( "slidestop", '#goTimeSelect,#goDateSelect', function( e ) {
	    	services.go.getRouteFromStops(services.go.data.stopsArray,$('#goDateSelect').val(),$('#goTimeSelect').val());
	    });
	    $( document ).on( "tap", '[data-action="showSavedStops"]', function( e ) {
	    	services.nextbus.showSavedStops();
	    });
	    $( document ).on( "tap", '[data-action="setMap"]', function( e ) {
	    	var routes=[];
	    	$(this).toggleClass('borderr2');
	    	$(this).toggleClass('borderBlue');
	    	$('#content [data-action="setMap"].borderr2').each(function(){
	    		routes.push($(this).attr('data-routeID'));
	    	})
	    	services.go.showRoutes(routes);
	    });
	    $( document ).on( "tap", '[data-action="setAction"]', function( e ) {
	    	$.mobile.loading('show')
	    	$('#content [data-action="setAction"]').removeClass('ui-btn-active');
	    	$(this).toggleClass('ui-btn-active');
			$('#content ul a[data-action]').attr('data-action',$(this).attr('data-target'));
			$.mobile.loading('hide');
	    });
		$( document ).on( "tap", '[data-action="getRouteInfo"]', function( e ) {
	    	services.go.getRouteInfo($(this).attr('data-routeid'));
	    });
	    $( document ).on( "tap", '[data-action="showAlerts"]', function( e ) {
	    	services.ttc.showAlerts();
	    });
	    $( document ).on( "tap", '[data-action="dirInfo"]', function( e ) {
	    	var index = $(this).attr('data-index');
	    	services[localStorage.currentService].dir.dirInfo(index);
	    });
/*	    $( document ).on( "tap", '[data-action="stopInfo"]', function( e ) {
	    	services.go.stopInfo([$(this).attr('data-stopID')],$(this).attr('data-routeID'));
	    });*/
	}//content
}
{
var jqFactory ={
	button: function(text, options){
		var output="";
		output+= '<button '+defined(options.attr)+' class="ui-btn '+defined(options.classes)+'">'+text+'</button>';

		return output;
	},
	grid: function(blocksObj){
		/*blocksObj[].*/
		var output="";
		var letters = "abcdefghijklmnopqrstuvwxyz";
		var letter;
		var length =Object.keys(blocksObj).length;

		if(length == 2){output='<div class="ui-grid-a">'};
		if(length == 3){output='<div class="ui-grid-b">'};

    	$.each(blocksObj, function(i, block){
    		letter = letters.charAt(i,1);
			output+='<div class="ui-block-'+letter+ ' '+defined(block.classes)+ '" '+defined(block.divAttr)+'>';
			output+= block.content;
			output+= '</div>';
    	});
    	output+= '</div>';
    	return output;
	},
	li: function(text, options){
		/*<li><a href="index.html" class="content ui-icon-back">
		    <p>Hey Stephen, if you're available at 10am tomorrow, we've got a meeting with the jQuery team.</p>
		    <p>- Stephen Weber</p>
		        <p class="ui-li-aside">6:24 pm</p>
		    </a></li>*/
		var output="<li class='"+options.liClass+"' "+defined(options.liAttr)+">";
		if(defined(options.btn)!=""){
			output+='<a href="#" class="'+defined(options.btnClass)+'" '+defined(options.btnAttr)+'>';
		}
		if(defined(options.header)!=""){
			output+='<h2>'+options.header+'</h2>';
		}
		output+='<p>'+text+'</p>';
		if(defined(options.text2)!=""){
			output+='<p>'+options.text2+'</p>';
		}
		if(defined(options.aside)!=""){
			output+='<p class="ui-li-aside">'+options.aside+'</p>';
		}
		if(defined(options.btn)!=""){
			output+='</a>';
		}
		output+="</li>";
		return output;
	},
	content:function(header, li, desc){
		var output="";
		output+= '<div data-role="header">\
					<h1>'+header+'</h1>\
					<button class="ui-btn-right ui-btn ui-btn-inline ui-mini ui-corner-all ui-btn-icon-right  ui-icon-delete ui-btn-icon-notext ui-nodisc-icon">Close</button>\
				</div>';
		if(defined(desc)!==""){output+=desc;}
		output+="<ul data-role='listview'>";
		output+=li;
		output+="</ul>";
		return output;
	}
};
var imgRes = {
	lm: function(){
		if(defined(localStorage.imgRes)=="lo"){return 'lo';}
	},
	path: function(path){
		if(typeof localStorage.imgRes==="undefined"){path = 'img/hi/' + path;return path;}
		if (localStorage.imgRes=="lo"){
			path = 'img/lo/' + path;
			return path;
		}
		else{path = 'img/hi/' + path;return path;}
	}
};
function defined(variable){
	if(typeof variable ==="undefined"){return "";} else{return variable;}
}
function alertMsg(message, duration){
    if (duration == 'long'){ duration=10000;}
    else if (duration == 'medium'){ duration=5000;}
    else if (duration == 'short'){ duration=3000;}
    else if (typeof duration==="undefined"){duration = 5000;}
    $('#alert').html(message);
    $('#alert').slideDown();
    setTimeout(function(){$('#alert').slideUp();}, duration);
}
function createMC(img,gridSize){
	var clusterStyles = [{
        textColor: 'white',
        textSize: 18,
        fontWeight: 'normal',
        fontFamily: 'Lato',
        url: img,
        height: 64,
        width: 64,
        anchorText: [-20,20]
    }];
	if(typeof gridSize!="undefined"){gridSize=30;}
    var mcOptions = {gridSize: gridSize, maxZoom: null, styles:clusterStyles,zoomOnClick: false};
    return new MarkerClusterer(map, [] , mcOptions);
}
function clearMarker(mArray){
    $.each(mArray, function(i, marker){
       marker.setMap(null);
    });
}
function clearListeners(){
	$.each(listeners, function(i, listener){

	});
}
function pluralize(number, text){
    if (number===0){return "Now";}
    else if(number==1){return number + " " + text;}
    else{return number  + " " + text+ "s";}
}
function randomColour(type) {
	var ran = Math.floor(Math.random() * 9) ;
	if (type=='normal'){return colourMatrix.normal[ran];}
}
function LongPress(map, length) {
	this.length_ = length;
	var me = this;
	me.map_ = map;
	me.timeoutId_ = null;
	google.maps.event.addListener(map, 'mousedown', function(e) {
	me.onMouseDown_(e);
	});
	google.maps.event.addListener(map, 'mouseup', function(e) {
	me.onMouseUp_(e);
	});
	google.maps.event.addListener(map, 'drag', function(e) {
	me.onMapDrag_(e);
	});
};
LongPress.prototype.onMouseUp_ = function(e) {
	clearTimeout(this.timeoutId_);
};
LongPress.prototype.onMouseDown_ = function(e) {
	clearTimeout(this.timeoutId_);
	var map = this.map_;
	var event = e;
	this.timeoutId_ = setTimeout(function() {
	google.maps.event.trigger(map, 'longpress', event);
	}, this.length_);
};
LongPress.prototype.onMapDrag_ = function(e) {
	clearTimeout(this.timeoutId_);
};
}//utilities
function service(){
var parent = this;
this.overlays={markers:{},mc:{},paths:{},kml:{}};
this.data={};
this.name;
this.dash = function(){};
this.clearMap={};
this.clearMap.all = function(){
	$.each(parent.overlays.markers, function(i, value){
		clearMarker(value);
	});
	$.each(parent.overlays.kml, function(i, value){
		clearMarker(value);
	});
	$.each(parent.overlays.mc, function(i, mc){mc.clearMarkers();});
	$.each(parent.overlays.paths, function(i, value){
		clearMarker(value);
	});
	parent.clearMap.subService();
}
this.clearMap.subService = function(){

};
this.dir = {};
this.dir.params = function(cb){
	var params = {};
	params.destination = $("#dir input[name='to']").val();
    params.timestamp = Math.round(date.getTime()/1000);//parse(input.date+" " +input.time+" -0500")/1000;
	var origin, mode;

    if($(" #dir input[name='from']").val().substring(6)=="Current Position"){params.origin=userPosition.lat+"," + userPosition.lng;}
    else{ params.origin=$(" #dir input[name='from']").val();}
	if(localStorage.currentService=="bixi"){params.mode="bicycling";}
	if(localStorage.currentService=="nextbus"){params.mode="transit";}
	if(localStorage.currentService=="c2g"){params.mode="driving";}

	if(typeof cb!=="undefined"){cb(params)}
};
this.dir.getData = function(params){
	$.mobile.loading('show');
	var parameters = encodeURI("&origin="+params.origin + "&destination="+params.destination + "&mode=" +params.mode+"&timestamp="+params.timestamp);
	var query = serverPath + '/server/main.php?command=getDirections'+ parameters;

	$.getJSON(query, function(dirData){
    	$.mobile.loading('hide');
        services[localStorage.currentService].dir.drawDir(dirData);
    }).fail(function(xhr, status, error){
        alertMsg("Something wrong with getting data from the server.");
    });
};
this.dir.getDir = function(){
	parent.dir.params(parent.dir.getData);
};

}
function nextbusService(){
	services.nextbus = new service();
	var parent = services.nextbus;
	var cityTag=servicesList.nextbus[localStorage.currentCity].tag;
	var serviceColor;
	parent.name='nextbus';
	parent.screenName = "transit";
	function processETA(data){
	    $.each(data, function(index, route){
	        if ($(route.direction).length==1){
	            route.direction = [route.direction];
	        }
	        if(typeof route.dirTitleBecauseNoPredictions!=="undefined"){
	        	return true;
	        }
	        $.each(route.direction, function(index2, direction){
	            if ($(direction.prediction).length==1){
	                data[index].direction[index2].prediction = [direction.prediction];
	            }
	        });
	    });

	    return data;
	}

	parent.init = function(){
		cityTag=servicesList.nextbus[localStorage.currentCity].tag;
		serviceColor=servicesList.nextbus[localStorage.currentCity].color;
		if(localStorage.currentCity=="toronto"){
			ttcService();
			services.ttc.init();
		}
		parent.overlays.mc.vehicles = createMC('img/'+cityTag+'Cluster.png', 50);
		parent.getVehicleLocation(parent.drawVehicles);
		parent.getRoutesList();
		google.maps.event.clearListeners(map, 'zoom_changed');
		google.maps.event.addListener(map, 'zoom_changed', function() {
		    if(localStorage.currentView=="allVehicles"){
				parent.clearMap.all();
			    parent.drawVehicles(parent.data.vehicleLocation,parent.overlays.mc, null, "getVehicleInfo" );
		    }
		});

	};
	this.initLoc=function(){
		//parent.getPredictionsFromLocation(userPosition.lat, userPosition.lng);
	};
	parent.dash = function(){
		parent.getPredictionsFromLocation(userPosition.lat, userPosition.lng);
		if(typeof localStorage.email !=="undefined"){
			parent.getFavStopsPredictions();
		}
	};
	parent.getFavStopsPredictions = function(){

		var stopString= "";
/*			$.each(parent.data.stopsFavList.ttc, function(i,stop){
			stopString+= stop +",";
		});*/
		stopString = stopString.substr(0, stopString.length-1);

		$.getJSON( serverPath+ "/server/nextbus.php",
			{command:"getFavStopsPredictions", email:encodeURIComponent(localStorage.email), cityTag:cityTag},
			function(data){
			console.log(data.result);
/*			data.result.predictions=processETA(data.result.predictions);
			parent.data.favStopsETA = data.result.predictions;
			writeDash(data.result.predictions);*/

			if(typeof cb!="undefined"){cb(data.result.predictions)};
	    }).fail(function(xhr, status, error) {
	        alertMsg("Something wrong with getting data from the server.");
	    });

		function writeDash(routes){
			var text="";
		    var stopText ={};
		    var i=0;
		    var text ='<li data-role="list-divider" style="border-left: 2px solid '+serviceColor+'"" data-action="showSavedStops">Saved Stops</li>';
		    console.log(routes);
			$.each(routes, function(index, route){
		        if(typeof stopText[route.stopTag]==="undefined"){
		            stopText[route.stopTag] = {};
		            stopText[route.stopTag].body = '';
		            stopText[route.stopTag].index = i;
		            stopText[route.stopTag].stopTags = [];
		            stopText[route.stopTag].stopTags.push(route.stopTags);
		            stopText[route.stopTag].dirTags = [];
		            i++;
		        }
		        if(typeof route.dirTitleBecauseNoPredictions!="undefined"){return true;}
		        $.each(route.direction, function(index, direction){
		            var attr, icon;
		            $.each(direction.prediction, function(index, vehicle){
		                if(typeof vehicle.affectedByLayover!="undefined"){return true;}
		                if(stopText[route.stopTag].stopTags.indexOf(route.stopTags)>-1 && stopText[route.stopTag].dirTags.indexOf(vehicle.dirTag)>-1 ){
		                    return false;
		                }

		                stopText[route.stopTag].stopTags.push(route.stopTags);
		                stopText[route.stopTag].dirTags.push(vehicle.dirTag);

						attr = 'data-module="nextbus" data-vID="'+vehicle.vehicle+'"';

						if (Number(route.stopTag)>499){icon = 'streetcar';}
				        else {icon = 'bus';}
						stopText[route.stopTag].body += jqFactory.li('Arriving at '+route.stopTitle,
							{btn:true, btnClass:"paddingtb0 content ui-icon-"+icon, btnAttr:'data-action="routeDetails" data-routeTag="'+route.routeTag+'" data-index="'+index+'"', header:direction.title,aside:pluralize(vehicle.minutes,"min")});
		            });
		        });
		    });
		    var stopTextArray = [];
		    $.each(stopText, function(index, value){
		        stopTextArray[value.index]={};
		        stopTextArray[value.index].body = value.body;
		    });
		    $.each(stopTextArray, function(index, value){
		        if (value.body==""){return true;}
		        text += value.body;
		    });
		   	$('#content ul[data-module="nextbus"]').append(text).listview().listview('refresh');

		    $.mobile.loading('hide');
		}
	};
	parent.getPredictionsFromLocation = function(lat, lng){
	    $.mobile.loading('show');
	    serviceColor=servicesList.nextbus[localStorage.currentCity].color;
	   	function writeDash(){
		   	var text="";
		    var routes = parent.data.nearestETA;
		    var routeText ={};
		    var i=0;

		    $.each(routes, function(index, route){
		        if(typeof routeText[route.routeTag]==="undefined"){
		            routeText[route.routeTag] = {};
		            routeText[route.routeTag].header = '<li data-role="list-divider" style="border-left: 2px solid '+serviceColor+'">'+route.routeTitle+'</li>';
		            routeText[route.routeTag].body = '';
		            routeText[route.routeTag].index = i;
		            routeText[route.routeTag].stopTags = [];
		            routeText[route.routeTag].stopTags.push(route.stopTags);
		            routeText[route.routeTag].dirTags = [];
		            i++;
		        }
		        $.each(route.direction, function(index, direction){
		            var directionText, k, l, attr, icon;
		            $.each(direction.prediction, function(index, vehicle){
		                if(typeof vehicle.affectedByLayover!="undefined"){return true;}
		                if(routeText[route.routeTag].stopTags.indexOf(route.stopTags)>-1 && routeText[route.routeTag].dirTags.indexOf(vehicle.dirTag)>-1 ){
		                    return false;
		                }

		                routeText[route.routeTag].stopTags.push(route.stopTags);
		                routeText[route.routeTag].dirTags.push(vehicle.dirTag);
		                if(localStorage.currentCity=="toronto"){
		                	k = direction.title.search("-");
			                l = direction.title.search("towards");
			                directionText = direction.title.substr(0, k) + " to " + direction.title.substr(l+8);
		                }
		                else{
		                	directionText = direction.title;
		                }
						attr = 'data-module="nextbus" data-vID="'+vehicle.vehicle+'"';

						if (Number(route.routeTag)>499){icon = 'streetcar';}
				        else {icon = 'bus';}
						routeText[route.routeTag].body += jqFactory.li('Arriving at '+route.stopTitle,
							{btn:true, btnClass:"paddingtb0 content ui-icon-"+icon, btnAttr:'data-action="routeDetails" data-routeTag="'+route.routeTag+'" data-index="'+index+'"', header:directionText,aside:pluralize(vehicle.minutes,"min")});
		            });
		        });
		    });
		    var routeTextArray = [];
		    $.each(routeText, function(index, value){
		        routeTextArray[value.index]={};
		        routeTextArray[value.index].header = value.header;
		        routeTextArray[value.index].body = value.body;
		    });
		    $.each(routeTextArray, function(index, value){
		        if (value.body==""){return true;}
		        text += value.header + value.body;
		    });
		   	$('#content ul[data-module="nextbus"]').append(text).listview().listview('refresh');

		    $.mobile.loading('hide');
	   	}
	    var query = serverPath+ "/server/nextbus.php?command=getPredictionsFromLocation&lat="+lat+"&lng="+lng+"&cityTag="+cityTag;
	    $.getJSON( query, function(data){
	    	if(typeof data.error !=='undefined'){
	    		 alertMsg("Something wrong with getting data from the server.");
	    		 $.mobile.loading('hide');
	    		 return false;
	    	}
	        parent.data.nearestETA=processETA(data.result.predictions);
	        $.mobile.loading('hide');
	        writeDash();
	        //if(typeof cb!="undefined"){cb()};
	    }).fail(function(xhr, status, error){
	    	$.mobile.loading('hide');
	        alertMsg("Something wrong with getting data from the server.");
	    });
	};
	parent.getVehicleLocation = function(cb){
	    $.mobile.loading('show');
	    var query = serverPath+ "/server/nextbus.php?command=getVehicleLocation"+"&cityTag="+cityTag;
	    $.getJSON( query, function(data){
	        $.each(data.result, function(index, value){
	            value['latLng'] =  new google.maps.LatLng(value['lat'], value['lng']);
	            value.index=index;
	        });
	        parent.data.vehicleLocation=data.result;
	        $.mobile.loading('hide');
	        localStorage.currentView="allVehicles";
	        if(typeof cb!="undefined"){cb(parent.data.vehicleLocation,parent.overlays.mc, null, "getVehicleInfo" )};
	    }).fail(function(xhr, status, error) {
	    	$.mobile.loading('hide');
	        alertMsg("Something wrong with getting data from the server.");
	    });
	};
	parent.drawVehicles = function (mArray, mc,targetMap, action){
	    var vMarkers = [];
	    var text, icon, heading, route, mClass,size;
	    $.mobile.loading('show');
		if(map.getZoom()<=14 &&localStorage.currentView=="allVehicles"){
			size="m";
			parent.overlays.mc.vehicles.setGridSize(25);
		}
		else{
			size="";
			parent.overlays.mc.vehicles.setGridSize(30);
		}
		$.each(mArray, function(i, vehicle){
			heading = vehicle.heading;
			route = vehicle.routeTag;
			if(localStorage.currentCity=="toronto"){
				if (Number(route)>499){icon = 'streetcar';}
				else {icon = 'bus';}
			}
			else{
				icon = 'bus';
			}


	        text=
	            '<div class="marker nextbus '+cityTag+' '+imgRes.lm()+' '+size+'" data-module="nextbus" data-vID = "'+vehicle.vID+'"  data-index = "'+i+'" data-action="'+defined(action)+'" style="/**/'+
	            		'transform:rotate('+ heading+ 'deg);-ms-transform:rotate('+ heading+'deg);-webkit-transform:rotate('+ heading+'deg);">\
	            	<div class="inner '+icon+'" style="transform:rotate(-'+ heading+ 'deg);-ms-transform:rotate(-'+ heading+'deg);-webkit-transform:rotate(-'+ heading+'deg);">\
	    				<div class="text">'+route+'</div>\
	    			</div>\
	        	</div>';
	        vMarkers.push(new RichMarker({
	        	position: vehicle['latLng'],
	        	draggable: false,
	            clickable: true,
	        	flat:true,
	        	anchor: RichMarkerPosition.MIDDLE,
	        	content: text,
	        	map : targetMap
	        }));
		})
		if(mc !=null){
			parent.overlays.mc.vehicles.addMarkers(vMarkers);
		}

		$.mobile.loading('hide');
	    return vMarkers;
	};
	parent.getRoutesList = function(){
		$.mobile.loading('show');
	    var query = serverPath+ "/server/nextbus.php?command=getRouteList"+"&cityTag="+cityTag;
	    $.getJSON( query, function(data){
	        parent.data.routesList=data.result;
	        $.mobile.loading('hide');
	    }).fail(function(xhr, status, error) {
	        alertMsg("Something wrong with getting data from the server.");
	    });
	};
	parent.getStops = function(){
		function showStops(){
			var text="";
			var markers=[];
			parent.clearMap.stops();
			$.each(parent.data.stopsList, function (i, stop){
				text=
		            '<div class="markersm busStop '+imgRes.lm()+'" data-module="nextbus" data-routeTag = "'+stop.routeTag+'" data-stopTag="'+stop.stopTag+'" data-action="stopInfo"></div>';
		        markers.push(new RichMarker({
		        	position: stop['latLng'],
		        	draggable: false,
		            clickable: true,
		        	flat:true,
		        	anchor: RichMarkerPosition.MIDDLE,
		        	content: text
		    	}));
		    });
		    var clusterStyles = [{
		        textColor: 'rgba(0, 0, 0, 0)',
		        textSize: 0,
		        fontWeight: 'normal',
		        fontFamily: 'Lato',
		        url: 'img/lo/busstopMarker.png',
		        height: 18,
		        width: 18,
		        anchorText: [0,0]
		    }];

			if(typeof parent.overlays.mc.stops !="undefined"){parent.overlays.mc.stops.addMarkers(markers);}
			else{
			    var mcOptions = {gridSize: 50, maxZoom: null, styles:clusterStyles,zoomOnClick: false};
			    parent.overlays.mc.stops = new MarkerClusterer(map, markers , mcOptions);
			    parent.overlays.mc.stops.setCalculator(function(){
				    var index = 0;
				    return {
				        text: "",
				        index: index
				    };
				});

				google.maps.event.addListener(parent.overlays.mc.stops, 'clusterclick', function(cluster) {
			    	map.panTo(cluster.getCenter());
			    	var markers = cluster.getMarkers();
			    	var stopArray = [];
					var beginPos, endPos, stopTag, routeTag;
					$.each(markers, function(i,marker){
						beginPos = marker.content.indexOf("data-stopTag")+14;
						endPos = marker.content.indexOf('"', beginPos);
						stopTag = marker.content.substr(beginPos, (endPos-beginPos));

						beginPos = marker.content.indexOf("data-routeTag")+17;
						endPos = marker.content.indexOf('"', beginPos);
						routeTag = marker.content.substr(beginPos, (endPos-beginPos));

						stopArray.push({stopTag:stopTag, routeTag:routeTag});
					});
					parent.stopInfo(stopArray);
		    	});
			}

		}
		var coords = '1x='+map.getBounds().getSouthWest().lat()+'&1y='+map.getBounds().getSouthWest().lng()+'&2x='+map.getBounds().getNorthEast().lat()+'&2y='+map.getBounds().getNorthEast().lng()
		var query = serverPath+ "/server/nextbus.php?command=getStopsBox&"+coords+"&cityTag="+cityTag;
		$.getJSON( query, function(data){
			$.each(data.result, function (i, stop){
    			stop.latLng =  new google.maps.LatLng(stop['lat'], stop['lng']);
    		});
	        parent.data.stopsList=data.result;
	        $.mobile.loading('hide');
	        showStops();
	    }).fail(function(xhr, status, error) {
	        alertMsg("Something wrong with getting data from the server.");
	    });
	};
	parent.stopInfo = function(stopsArray){

		function writeETA(data){
			var routeText ={};
			var text="";
	    	var i=0;

			$.each(data, function(index, route){
		        if(typeof routeText[route.routeTag]==="undefined"){
		            routeText[route.routeTag] = {};
		            routeText[route.routeTag].header = '<li data-role="list-divider" class="borderl2 borderRed">'+route.routeTitle+'</li>';
		            routeText[route.routeTag].body = '';
		            routeText[route.routeTag].index = i;
		            routeText[route.routeTag].stopTags = [];
		            routeText[route.routeTag].stopTags.push(route.stopTags);
		            routeText[route.routeTag].dirTags = [];
		            i++;
		        }
		       	if(typeof route.dirTitleBecauseNoPredictions!=="undefined"){
		        	return true;
		        }
		        $.each(route.direction, function(index, direction){
		            var directionText, k, l, attr, icon;
		            $.each(direction.prediction, function(index, vehicle){

		                routeText[route.routeTag].stopTags.push(route.stopTags);
		                routeText[route.routeTag].dirTags.push(vehicle.dirTag);
		                 if(localStorage.currentCity=="toronto"){
		                	k = direction.title.search("-");
			                l = direction.title.search("towards");
			                directionText = direction.title.substr(0, k) + " to " + direction.title.substr(l+8);
		                }
		                else{
		                	directionText = direction.title;
		                }
						attr = 'data-module="ttc" data-vID="'+vehicle.vehicle+'"';

						if (Number(route.routeTag)>499){icon = 'streetcar';}
				        else {icon = 'bus';}
						routeText[route.routeTag].body += jqFactory.li("",
							{btn:true, btnClass:"ui-icon-"+icon, header: directionText, btnAttr:'data-action="routeDetails" data-routeTag="'+route.routeTag+'" data-index="'+index+'"',aside:pluralize(vehicle.minutes,"min")});
						//writeli(directionText,'Arriving at '+route.stopTitle,icon,pluralize(vehicle.minutes,"min"),attr);
		            });
		        });
		    });

		    var routeTextArray = [];
		    $.each(routeText, function(index, value){
		        routeTextArray[value.index]={};
		        routeTextArray[value.index].header = value.header;
		        routeTextArray[value.index].body = value.body;
		    });
		    $.each(routeTextArray, function(index, value){
		        if (value.body==""){return true;}
		        text += value.header + value.body;
		    });

			return text;
		}

		var stops = [];
		var text="";
		var icon;
		var data = parent.data.stopsList;
		var stopString1="";//$stopsNBString .= "&stops=" . $routeTag . "%7C" . $stopTag;
		var stopString2="";//$stopsNBString .= "&stops=" . $routeTag . "%7C" . $stopTag;
		$.mobile.loading('show');

		$.each(stopsArray, function(i, stop){
			text += '<li data-role="list-divider" data-stop="'+stop.stopTag+'"></li>';
			stopString1+='&stops='+stop.routeTag+'|'+stop.stopTag;
			stopString2+= stop.stopTag +",";
		});

		var query = serverPath+ "/server/nextbus.php?command=getPredictionFromStops&stopString="+encodeURIComponent(stopString1)+"&cityTag="+cityTag;
	    $.getJSON( query, function(data){

			var text="";

			text += writeETA(processETA(data.result.predictions));

	        $.each(data.result, function(i, value){
	        	if(defined(value.dirTitleBecauseNoPredictions)){
	        		if(i==0){text += '<li data-role="list-divider">Route(s) with no Predictions</li>';}
	        		if (Number(value.routeTag)>499){icon = 'streetcar';}
					else {icon = 'bus';}
	        		text += jqFactory.li("",
						{btn:true, btnClass:"ui-icon-"+icon, btnAttr:'data-action="routeDetails" data-routeTag="'+value.routeTag+'"', aside: "No prediction" , header:value.routeTitle});
	        	}
	        });

	        parent.data.stopInfo = data.result;
	        text+='<li data-role="list-divider">Stop Options</li>';
	        text += jqFactory.li("", {btn:true, btnClass:"ui-icon-star", header:"Save Stop", btnAttr:'data-module="nextbus" data-action="toggleFavStop" data-stopTag="'+stopsArray[0].stopTag+'"'});
			text +='<li><input type="text" name="name2" id="txtComment" value="" placeholder="Post comment for stop" data-clear-btn="true"></li>';

			parent.stopInfoFav(stopsArray[0].stopTag);

	        $('#content').html(jqFactory.content(data.result.predictions[0].stopTitle, text)).trigger('create');
	        $('#content ul').listview().listview('refresh');
	        openContent();
	        $.mobile.loading('hide');
	    }).fail(function(xhr, status, error) {
	        alertMsg("Something wrong with getting data from the server.");
	    });

	    stopString2 = stopString2.substring(0, stopString2.length-1);

	    $.getJSON( serverPath+ "/server/nextbus.php", {command:"getStopInfo", stopsString:encodeURIComponent(stopString2), cityTag:cityTag},function(data){
			console.log(data);
			var position = new google.maps.LatLng(data.result[0].lat, data.result[0].lng);
			map.setZoom(18);
			map.panTo(position);
	    }).fail(function(xhr, status, error) {
	        alertMsg("Something wrong with getting data from the server.");
	    });
	}
	parent.getVehicleInfo = function(vID){
		var vehicle;
		$.each(parent.data.vehicleLocation, function(i, value){
			if(value.vID==vID){
				vehicle = value;
				return false;
			}

		});
		var query = serverPath+ "/server/nextbus.php?command=getVehicleInfo&vID="+vID+"&dirTag="+vehicle.dirTag+"&cityTag="+cityTag;
		$.mobile.loading('show');

		$.getJSON( query, function( result ) {
			localStorage.currentView="VehicleInfo";
			console.log(result);
	        drawMap(result.result);
	    }).fail(function(xhr, status, error){
			$.mobile.loading('hide');
	        alertMsg("Something wrong with getting data from the server.");
	    });

		function drawMap(result){
		    var path = [];
		    var icon, desc;
		    var text ="";
		    var vArrivals = [];
			var predictions = [];
			var vID= vehicle.vID;
			var distance=0;
			var speed;
			var icon, vtype;
			var d;
			parent.clearMap.all();
			parent.overlays.paths.routes=[];
			map.panTo(vehicle.latLng);

			$.each(result.history, function(i, vehicle){
				vehicle.latLng = new google.maps.LatLng(vehicle.lat,vehicle.lng);
				vehicle.routeTag = result.dir.routeTag;
				if(i>0){
					distance += google.maps.geometry.spherical.computeDistanceBetween (vehicle.latLng, result.history[i-1].latLng);
				}

			});

			speed = Math.round(distance/4*60/1000);

			if(localStorage.currentCity=="toronto"){
				if (Number(result.dir.routeTag)>499){icon = 'ttcStreetcar'; vtype="Streetcar";}
				else {icon = 'ttcBus';vtype="Bus";}
			}
			else{
				icon = cityTag+'Bus';vtype="Bus";
			}

			text+='<li style="padding-top:0; padding-bottom:0;"><img src="img/hi/'+icon+'.png"><h2 class="content">'+result.dir.dirTitle+'</h2><p class="content">'+vtype+' '+vID+' travelling at '+speed+'kph on average</p></li>';
		    predictions = processETA(result.predictions.predictions);

		    $.each(result.stops, function (i, stop){
		        stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);
		        path.push(stop.latLng);
		    });

		    parent.overlays.paths.routes.push(new google.maps.Polyline({
		        path: path,
		        geodesic: true,
		        strokeColor: result.dir.colour,
		        strokeOpacity: 0.7,
		        strokeWeight: 5,
		        map:map
		    }));

		    $.each(predictions, function(j, stop){
		        $.each(stop.direction, function(k, direction){
		            $.each(direction.prediction, function(l, vehicle){
		                if(vID==vehicle.vehicle){
		                    vehicle.stopTag = stop.stopTag;
		                    vehicle.stopTitle = stop.stopTitle;
		                    vArrivals.push(vehicle);
		                }
		            });
		        });
		    });

		    vArrivals.sort(function(a,b) {
		      return a.minutes - b.minutes;
		    });
		    text+='<li data-role="list-divider">Arriving at:</li>';
		    $.each(vArrivals, function(p, arrival){
		    	text += jqFactory.li("", {btn:true, btnClass:"ui-icon-arrow-r", header:arrival.stopTitle, btnAttr:'data-action="stopInfo" data-routeTag="'+result.dir.routeTag+'" data-stopTag="'+arrival.stopTag+'"',aside:pluralize(arrival.minutes,"min")});
		        if(p>=4){return false;}
		    });

		    desc = '<div class="ui-grid-a">\
		    		<div class="ui-block-a"><a href="#" class="ui-btn ui-corner-all ui-icon-check ui-btn-icon-right" data-module="ttc" data-action="feedback" data-type="compliment" data-vID="'+vehicle.vID+'">Report Good Service</a></div>\
		    		<div class="ui-block-b"><a href="#" class="ui-btn ui-corner-all ui-icon-delete ui-btn-icon-right" data-module="ttc" data-action="feedback" data-type="critique" data-vID="'+vehicle.vID+'">Report Poor Service</a></div>\
					</div>';
			if(localStorage.currentCity=="toronto"){
				text+='<li data-role="list-divider">Give Feedback:</li>';
				text += jqFactory.li("", {btn:true, btnClass:"ui-icon-check", header:"Good Feedback", btnAttr:'data-module="ttc" data-action="feedback" data-type="compliment" data-vID="'+vehicle.vID+'"'});
				text += jqFactory.li("", {btn:true, btnClass:"ui-icon-delete", header:"Poor Feedback", btnAttr:'data-module="ttc" data-action="feedback" data-type="critique" data-vID="'+vehicle.vID+'"'});
			}

			openContent();
			$('#content').html(jqFactory.content('Route '+result.dir.routeTag, text)).trigger('create');



			parent.overlays.markers.vehicleHistory = parent.drawVehicles(result.history, null, null, '');
			var opacity = 1;
			$.each(parent.overlays.markers.vehicleHistory, function(j, marker){
				marker.content = marker.content.replace('style="/**/','style="/**/opacity:'+opacity+"; ");
				d = new Date(Date.parse(result.history[j].date));

				marker.content = marker.content.replace('<div class="text">'+result.dir.routeTag,'<div class="text">'+d.getHours()+":"+d.getMinutes());

				opacity -= 0.2;
				marker.setMap(map);

			});
/*			$.each(parent.data.vDetails.history, function(i, vehicle){
				console.log(d.parse(vehicle.date));
			});*/
		    $.mobile.loading('hide');
		    parent.data.vehicleDetails=result;
		}

};
	parent.dir.drawDir = function(dirData){
		var paths=[];
		var text="";
		var headline;
		var textDeets;
		$.mobile.loading('show');
		$.each(dirData.routes, function(i, route){
			route.path = google.maps.geometry.encoding.decodePath(route.overview_polyline.points);
			route.colour = randomColour('normal');
			$.each(paths, function(k, value){
				if (value.pathEncode==route.overview_polyline.points){route.colour=value.strokeColor;}
			});
			paths.push(new google.maps.Polyline({
				path: route.path,
				pathEncode : route.overview_polyline.points,
				geodesic: true,
				strokeColor:  route.colour,
				strokeOpacity: 0.85,
				strokeWeight: 5,
				map:map
			}));

			$.each(route.legs[0].steps, function(j, step){
				if (step.travel_mode=="TRANSIT"){headline=step.transit_details.headsign; return false;}
			});
			text += jqFactory.li("Trip length: " + route.legs[0].duration.text + "",
	            	{btn:true, btnClass:"content ui-icon-arrow-r", btnAttr:'data-action="dirInfo" data-module="nextbus" style="border-left: 2px solid '+route.colour+'" data-index="'+i+'"', header:headline});
		});

		var southWest = new google.maps.LatLng(dirData.routes[0].bounds.southwest.lat,dirData.routes[0].bounds.southwest.lng);
		var northEast = new google.maps.LatLng(dirData.routes[0].bounds.northeast.lat,dirData.routes[0].bounds.northeast.lng);

		var bounds = new google.maps.LatLngBounds(southWest,northEast);
		map.fitBounds(bounds);

		parent.clearMap.all();
		parent.data.dir = {};
		parent.data.dir.results = dirData.routes;
		$('#dir ul').html(text).listview().listview("refresh");
		$.mobile.loading('hide');
		parent.overlays.paths.directions = paths;
		localStorage.currentView="directions";
	};
	parent.dir.dirInfo = function(index){
	    parent.clearMap.all();
	    var route = parent.data.dir.results[index];
	    var text="";
	    var icon,colour;
	    var headline;
	    $.mobile.loading('show');
	    console.log(route);

	    $.each(route.legs[0].steps, function(i, step){
	        if(step.travel_mode=="WALKING"){icon = "walk";colour="#6699FF";}
	        if(step.travel_mode=="TRANSIT"){icon = "bus";colour=route.colour;}

			text += jqFactory.li(step.html_instructions+'(For '+step.distance.text+' or '+step.duration.text+')',
	            	{btn:true, btnClass:"content ui-icon-"+icon});

	        parent.overlays.paths.directions.push(new google.maps.Polyline({
	            path:google.maps.geometry.encoding.decodePath(step.polyline.points),
	            geodesic: true,
	            strokeColor: colour,
	            strokeOpacity: 0.85,
	            strokeWeight: 5,
	            map:map
	        }));
	    });

		$.each(route.legs[0].steps, function(j, step){
				if (step.travel_mode=="TRANSIT"){headline=step.transit_details.headsign; return false;}
		});

		$('#content').html(jqFactory.content(headline, text)).trigger('create');
		$('#content ul').listview().listview('refresh');

	    $.mobile.loading('hide');
	};
	parent.searchAutocomplete = function(){
	    var search = $('#search input').val();
	    var target = $("#searchResults ul");
	    var text ='<li data-role="list-divider">Transit Routes</li>';
	    $.each(parent.data.routesList, function(index, route){
	        if(route.routeTag.search(search)===0){
	            text += jqFactory.li(route.routeTitle,
	            	{btn:true, btnClass:"content paddingtb0 ui-icon-info", btnAttr:'data-action="routeDetails" data-routeTag="'+route.routeTag+'" data-index="'+index+'"',
	            	liClass: 'borderl2', liAttr:'style="border-color:'+route.colour+' !important;"'});
	        }
	    });

	    $("#searchResults ul").html(text).listview().listview('refresh').slideDown();
	}
	parent.routeInfo = function(routeTag){
	    $.mobile.loading('show');
	    var query = serverPath+ "/server/nextbus.php?command=getRouteInfo&routeTag="+routeTag+"&cityTag="+cityTag;
	    var route;

	    $.each(parent.data.routesList, function(i,value){
	    	if(value.routeTag==routeTag){route=value;}
	    });

	    $.getJSON( query, function(data){
/*    		$.each(data.stops, function (i, stop){
    			stop.latLng =  new google.maps.LatLng(stop['lat'], stop['lng']);
    		});*/
	        parent.data.routeInfo=data;
	        draw(data);
	        $.mobile.loading('hide');
	        localStorage.currentView="routeInfo";
	        if(typeof cb!="undefined"){cb(parent.data.vehicleLocation,parent.overlays.mc )};
	    }).fail(function(xhr, status, error) {
	    	$.mobile.loading('hide');
	        alertMsg("Something wrong with getting data from the server.");
	    });

	    function draw(data){
	    	var li ="";
	        var path=[];
	        var vehicles=[];
	        parent.clearMap.all();
	        parent.overlays.paths.routes=[];
			//parent.showStops(data.stops);
			localStorage.currentView="routeInfo";
			$.each(data.route.path, function(i, value){
				path=[];
				$.each(value.point, function(j, point){
					point.latLng = new google.maps.LatLng(point['lat'], point['lon']);
					path.push(point.latLng);
				});
				parent.overlays.paths.routes.push(new google.maps.Polyline({
					path: path,
					geodesic: true,
					strokeColor:  route.routeTitle.routeColour,
					strokeOpacity: 0.85,
					strokeWeight: 5,
					map:map
				}));
			});

			$.each(parent.data.vehicleLocation, function(i, vehicle){
				if(vehicle.routeTag == route.routeTag){
					vehicles.push(vehicle);
				}
			});
			parent.overlays.markers.vehicles = parent.drawVehicles(vehicles, null, map, "vDetails");
			var southWest = new google.maps.LatLng(data.route.latMin,data.route.lngMin);
			var northEast = new google.maps.LatLng(data.route.latMax,data.route.lngMax);
			var bounds = new google.maps.LatLngBounds(southWest,northEast);
			map.fitBounds(bounds);

			$.each(data.dir, function (i, direction){
	        	li += jqFactory.li(direction.dirTitle,
	            	{btn:true, btnClass:"content ui-icon-info"});
	        });
	        openContent();
	        $('#content').html(jqFactory.content(route.routeTitle, li,'<p class="paddingl8">Currently being served by '+vehicles.length+ ' vehicles.</p>')).trigger('create').slideDown();
	        $('#panel').panel('close');
	    }
	};
	parent.toggleFavStop = function(stopTag){
		if(typeof localStorage.email =="undefined"){
			alertMsg("You must first login.");
			return false;
		}
		$.getJSON( serverPath+ "/server/nextbus.php",
			{command:"toggleFavStop", stopTag:encodeURIComponent(stopTag), email:encodeURIComponent(localStorage.email),cityTag:cityTag},
			function(data){
			parent.stopInfoFav(stopTag);
	    }).fail(function(xhr, status, error) {
	        alertMsg("Something wrong with getting data from the server.");
	    });
	}
	parent.getFavStopsList = function(cb){
		if(typeof localStorage.email =="undefined"){
			alertMsg("You must first login.");
			return false;
		}
		$.getJSON( serverPath+ "/server/nextbus.php", {command:"getFavStopsList", email:encodeURIComponent(localStorage.email),cityTag:cityTag},function(data){
			parent.data.stopsFavList=data.result;
			if(typeof cb!="undefined"){cb(data.result)};
	    }).fail(function(xhr, status, error) {

	        alertMsg("Something wrong with getting data from the server.");
	    });
	};
	parent.stopInfoFav = function(stopTag){
		if(typeof localStorage.email =="undefined"){
			return false;
		}
		parent.getFavStopsList(function(result){
			$.each(result, function(i, value){
				if(value==stopTag){
					$('#content [data-action="toggleFavStop"]').addClass('ui-btn-active');
					return false;
				}
				$('#content [data-action="toggleFavStop"]').removeClass('ui-btn-active');
			});
		});
	};
	parent.showSavedStops = function(){

		if(typeof localStorage.email =="undefined"){
			alertMsg("You must first login.");
			return false;
		}
		$.getJSON( serverPath+ "/server/nextbus.php", {command:"getFavInfo", email:encodeURIComponent(localStorage.email),cityTag:cityTag},function(data){
			console.log(data);
			writeContent(data.result);
			$.each(data.result, function(i, stop){
				stop.latLng =  new google.maps.LatLng(stop['lat'], stop['lng']);
			});
			if(typeof cb!="undefined"){cb(data.result)};
	    }).fail(function(xhr, status, error) {
	        alertMsg("Something wrong with getting data from the server.");
	    });
		function writeContent(data){
			var text ="";
			var stopArr={};
			var stopTitle,stopRouteTags;
			var stopRouteTags;
			$.each(data, function(i, stop){
				stopArr[stop.stopTag]=[];
				stopArr[stop.stopTag].push(stop);
			});
            $.each(stopArr, function(i, stop){
            	stopRouteTags=[];
            	$.each(stop,function(i, route){
					stopRouteTags.push({stopTag:route.stopTag, routeTag:route.routeTag});
            	});
        		text += jqFactory.li("",
    				{btn:true, btnClass:"content ui-icon-arrow-r",
    				btnAttr:'data-module="ttc" data-action="stopInfo" data-stopRouteTags = "'+encodeURIComponent(JSON.stringify(stopRouteTags))+'"', header:stop[0].stopTitle});
            });

	    	$('#content').html(jqFactory.content('Saved Stops', text)).trigger('create');

	        openContent();

            $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.stops)};
		}

	};
	parent.clearMap.stops=function(){
		if(defined(parent.overlays.mc.stops)!=""){parent.overlays.mc.stops.clearMarkers()};
	};
	parent.clearMap.subService = function(){
		if(localStorage.currentCity=="toronto" && typeof services.ttc!="undefined"){services.ttc.clearMap.subway();}
	}

}
function ttcService(){
	services.ttc = new service();
	var parent = services.ttc;
	parent.name='ttc';
	parent.init = function(){
		parent.getAlerts();
		parent.showSubway();
	};
	parent.feedbackLoc = function(type){
		getPosition(function(type){
			parent.feedback(type);
		});
	};
	parent.feedback = function(type,vID){
	    var userLocation, vehicleLocation, selectVehicle;
	    var distance = [];

	    $.mobile.loading('show');
	    $( ".ui-panel" ).panel( "close" );

		if(typeof vID==="undefined"){
		    userLocation  = new google.maps.LatLng(userPosition.lat, userPosition.lng);

		    $.each(services.nextbus.data.vehicleLocation, function(index, vehicle){
		        vehicleLocation = vehicle.latLng;

		        distance[index]=[];
		        distance[index][0] = google.maps.geometry.spherical.computeDistanceBetween (userLocation, vehicleLocation);
		        distance[index][1] = index;
		    });
	        distance.sort(function(a,b) {
		      return a[0] - b[0];
		    });

		    selectVehicle = services.nextbus.data.vehicleLocation[distance[0][1]];
		}
		else{
			$.each(parent.data.vehicleLocation, function(index, vehicle){
				if(vehicle.vID==vID){
					selectVehicle=vehicle;
					return false;
				}
			});
		}

	    map.panTo(selectVehicle.latLng);


	    setTimeout(function(){
	        var d = new Date();
			var time = d.getHours() +":" + d.getMinutes();
			var date = (d.getMonth()+1) +"/" + d.getDate()  + "/" + d.getFullYear();
			var text;
			if (type=="compliment"){
			    text = "@TTChelps Got great service from TTC staff! (On vehicle " +selectVehicle.vID + " of route " +selectVehicle.routeTag+" at " + time + " " +date + ")";
			}
			else{
			    text = "@TTChelps Got poor service from TTC staff. (On vehicle " +selectVehicle.vID + " of route " +selectVehicle.routeTag+" at " + time + " " +date + ")";
			}
			window.open("https://twitter.com/intent/tweet?text="+text);
	    	}
	    ,1000);
	    $.mobile.loading('hide');
	};
	parent.getAlerts = function(){
		$.get(serverPath+ "/server/ttc.php?command=getAlerts", function(data){
			parent.data.alerts=$.parseJSON(data);
			write();
            $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb()};
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});

		function write(){
			var popupMsg="TTC Service Alerts:";
			var pos, alertDesc;
			if(typeof parent.data.alerts.error !='undefined'){
				alertMsg("Cannot retrieve TTC service alerts", 'short');
				return false;}
			$.each(parent.data.alerts, function(i, value){
				alertDesc = value.description[0];
				pos = alertDesc.indexOf('Affecting:');
				if(pos>-1){

					if(alertDesc.indexOf('Routes:',pos)>-1){
						pos = 	alertDesc.indexOf('Routes:',pos);
						pos+=7;
						value.header= alertDesc.substr(pos);
						value.descShrt = alertDesc.substr(0,pos)
						popupMsg += alertDesc.substr(pos) + ',';
					}
					else if(alertDesc.indexOf('Subway/RT Lines:',pos)>-1){
						pos = 	alertDesc.indexOf('Subway/RT Lines:',pos);
						pos+=16;
						value.header= alertDesc.substr(pos);
						value.descShrt = alertDesc.substr(0,pos)
						popupMsg += alertDesc.substr(pos) + ',';
					}
					else if(alertDesc.indexOf('System Wide Alert',pos)>-1){
						pos = 	alertDesc.indexOf('System Wide Alert',pos);
						value.header= alertDesc.substr(pos);
						value.descShrt = alertDesc.substr(0,pos)
					}
				}

			});
			popupMsg = popupMsg.substr(0, popupMsg.length - 1);
			popupMsg = '<a href="#" data-action="showAlerts" data-module="ttc" style="color:#CC0000; text-decoration:none;">'+popupMsg+'</a>';
			alertMsg(popupMsg, 'long');
		}
	};
	parent.showAlerts = function(){
		var text ="";

		var pathCoord=[];
		var stops=[];
		$.each(parent.data.alerts, function(i, value){
    		text += jqFactory.li('<span class="content">'+value.description[0]+'</span>',
				{btn:false, header:value.header});
        });

    	$('#content').html(jqFactory.content('Service Alerts', text)).trigger('create');
        openContent();
        $.mobile.loading('hide');
	}
	parent.showSubway = function(){
		var routeArray = [32698,32699,32700,32701];
		parent.clearMap.subway();
		parent.overlays.kml.subway=[];
		$.each(routeArray, function(index, value) {
			parent.overlays.kml.subway.push(new google.maps.KmlLayer('http://local-motion.ca/server/other/maps/ttc/'+value+'.kml?2',{map:map, preserveViewport:true, clickable:false}));
		});

		$.get(serverPath+ "/server/ttc.php", {command:"listSubway"}, function(data){
			parent.data.subwayStops=$.parseJSON(data);
			drawStops();
            $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.stops)};
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});

		function drawStops(){
			var stops=[];
			var markerContent;
		    var markersArray = [];

				$.each(parent.data.subwayStops.data, function(i,stop){
					stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);

					markerContent="<div class='markersm subWay "+imgRes.lm()+"' data-module='ttc' data-action='subwayInfo' data-stopID='"+stop.id+"'></div>";

			        markersArray.push(new RichMarker({
							position: stop.latLng,
							draggable: false,
							clickable: true,
							flat:true,
							anchor: RichMarkerPosition.MIDDLE,
							content: markerContent
			        }));
				});
			var clusterStyles = [{
		        textColor: 'rgba(0, 0, 0, 0)',
		        textSize: 0,
		        fontWeight: 'normal',
		        fontFamily: 'Lato',
		        url: 'img/lo/subwayMarker.png',
		        height: 18,
		        width: 18,
		        anchorText: [0,0]
		    }];

		    var mcOptions = {gridSize: 50, maxZoom: null, styles:clusterStyles,zoomOnClick: false};

			parent.overlays.mc.subway = new MarkerClusterer(map, markersArray , mcOptions);

			parent.overlays.mc.subway.setCalculator(function(){
			    var index = 0;
			    return {
			        text: "",
			        index: index
			    };
			});

			google.maps.event.addListener(parent.overlays.mc.subway, 'clusterclick', function(cluster) {
				map.panTo(cluster.getCenter());
				var markers = cluster.getMarkers();
				var stopIndex = [];
				var beginPos, endPos;
				$.each(markers, function(i,marker){
					beginPos = marker.content.indexOf("data-stopID")+13;
					endPos = marker.content.indexOf("'", beginPos);

					stopIndex.push(marker.content.substr(beginPos, (endPos-beginPos)));

				});
				parent.subwayInfo(stopIndex)
		    });

			$.mobile.loading('hide');
		}
	};
	parent.subwayInfo = function(stopArray){
		var stopStr="";
		var stopName;
		$.each(stopArray, function(i, route){
			stopStr +="'" + route +"',";
		});

		stopStr = encodeURIComponent(stopStr.substr(0,stopStr.length - 1));
		$.get(serverPath+ "/server/ttc.php", {command:'subwayInfo', stopStr:stopStr},function(data){
			parent.data.subwayInfo=$.parseJSON(data);
			console.log(parent.data.subwayInfo);
			write();
            $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb()};
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});
		function write(){
			var block ='';
			var text ="";

			$.each(parent.data.subwayInfo.data, function(i, route){
				block ='';
				block += '<div class="ui-grid-b">\
							<div class="ui-block-a" style="color:#'+route.color+';">'+route.name+'</div>\
						    <div class="ui-block-b" style="text-align:right;">First Train</div>\
						    <div class="ui-block-c" style="text-align:right;">Last Train</div>';
				$.each(route.directions, function(i, direction){
					block += '	<div class="ui-block-a">'+direction.name+'</div>\
							    <div class="ui-block-b" style="text-align:right;">'+direction.min.arrival+'</div>\
							    <div class="ui-block-c" style="text-align:right;">'+direction.max.arrival+'</div>';
				});
				block+='</div>';
				text += jqFactory.li(block,{btn:false});
            });

			$.each(parent.data.subwayStops.data, function(i,value){
				if(value.id==stopArray[0]){
					stopName = value.name;
					map.panTo(value.latLng);
					return false;
				}
			});

	    	$('#content').html(jqFactory.content(stopName, text)).trigger('create');

	        openContent();

	        $.mobile.loading('hide');

		}
	};
	parent.clearMap.subway = function(){
		if(typeof parent.overlays.kml.subway!="undefined"){clearMarker(parent.overlays.kml.subway);}
		if(typeof parent.overlays.mc.subway!="undefined"){parent.overlays.mc.subway.clearMarkers();}
	}
}
function bixiService(){
	services.bixi = new service();
	var parent = services.bixi;
	var cityTag = servicesList.bixi[localStorage.currentCity].tag;
	var serviceColor;

	parent.name='bixi';
	parent.screenName = parent.name;
	parent.init = function(){
		cityTag=servicesList.bixi[localStorage.currentCity].tag;
		serviceColor=servicesList.bixi[localStorage.currentCity].color;
		google.maps.event.clearListeners(map, 'zoom_changed');
		parent.overlays.mc.stations = createMC('img/bixiCluster.png');
		if(typeof parent.data.stations==="undefined"){
			parent.getStations(parent.drawStations);
		}
		else{
			parent.drawStations(parent.data.stations);
		}
	};
	parent.dash = function(){parent.getStations(parent.writeDash);};
	parent.getStations = function(cb){
	    var query = serverPath + '/server/bixi.php?command=getStations_v5'+"&cityTag="+cityTag;
	    $.mobile.loading('show');

	     $.getJSON( query, function(data){
	        $.each(data.result,function(index, station){
	            station.lat = Number(station.lat);
	            station.lng = Number(station.lng);
	            station.latLng = new google.maps.LatLng(station.lat, station.lng);
	            station.bikes = Number(station.bikes);
	            station.docks = Number(station.docks);
	            station.id = Number(station.id);
	            station.index = index;
	        });

	        parent.data.stations=data.result;
	        $.mobile.loading('hide');
	        if(typeof cb!=="undefined"){cb(parent.data.stations)}
	    }).fail(function(xhr, status, error) {
	    	$.mobile.loading('hide');
	        alertMsg("Something wrong with getting data from the server.", 'medium');
	    });
	};
	parent.writeDash = function(){
		var location, attr, distance;
		var stations = parent.data.stations;
		var text = '<li data-role="list-divider" class="borderl2 borderBlue">Nearest Bixi Stations</li>';
		$.each(stations, function(i,station){
			location = new google.maps.LatLng(userPosition.lat,userPosition.lng);
			station.distance = google.maps.geometry.spherical.computeDistanceBetween (location, station.latLng);
		});

		stations.sort(function(a,b) {
	    	return a.distance - b.distance;
	    });

	  	$.each(stations, function(i, station){
			distance = Math.round(station.distance/10)/100;
	    	attr = 'data-module="bixi" data-index="'+station.index+'"';

		  	text +=jqFactory.li('Free bikes: '+station.bikes+', Empty docks: '+station.docks,
				{header:station.name, aside: distance + 'km', btn:true, btnClass:"paddingtb0 content ui-icon-bike", btnAttr:attr});
	  		if (i==2){return false;}
	  	});

	  	$('#content ul[data-module="bixi"]').append(text).listview().listview('refresh');
	};
	parent.drawStations = function(mArray,callback){
		var ratio, content,bixiIcon, text;
		var markers = [];
		$.mobile.loading('show');

		mArray.sort(function(a,b) {
			return a.index - b.index;
		});
		$.each(mArray, function(i,station){
		   ratio = station.bikes / ((station.bikes+station.docks))*5;
		   ratio = Math.round(ratio);
		   if(station.bikes+station.docks==0){
		   	ratio=0;
		   }

		   bixiIcon="background-image:url('"+imgRes.path("bixiMarker"+ratio+".png")+"'); background-size: cover;";
		   if (station.bikes==station.docks){text="Full";}
		   if (station.bikes==0){text="Empty";}
		   text = ratio*20 + "%";
		   content=
		       '<div class="marker" data-module = "bixi" data-action="getDeets" data-index = "'+i+'" style="'+bixiIcon+'">' +
		           '<div class="marker text">'+text+'</div>\
		       </div>';
		   markers.push(new RichMarker({
		       position: station.latLng,
		       draggable: false,
		       clickable: true,
		       flat:true,
		       anchor: RichMarkerPosition.MIDDLE,
		       content: content
		   }));
		});

		parent.overlays.mc.stations.addMarkers(markers);

		parent.overlays.markers.stations = markers;
		$.mobile.loading('hide');
		if(typeof callback !=="undefined"){callback();}
	};
	parent.getDeets = function(index){
		$.mobile.loading('show');

		parent.data.stations.sort(function(a,b) {
			return a.index - b.index;
		});

		var station = parent.data.stations[index]


		map.panTo(station.latLng);


		var query = serverPath+ "/server/bixi.php?command=getStationDB_v2&id="+station.id+"&cityTag="+cityTag;;
		$.getJSON( query).complete(function(result) {
			var heading, lat, lng, pitch;
		    if(result.responseJSON.heading =="0"){
		    	heading =0;
		    	pitch = 0;
		    	lat = station.lat;
		    	lng = station.lng;
		    }
		    else{
		    	heading = result.responseJSON.heading;
		    	pitch = result.responseJSON.pitch;
		    	lat = result.responseJSON.lat;
		    	lng = result.responseJSON.lng
		    }
			console.log(result);
			var img = 'http://maps.googleapis.com/maps/api/streetview?size='+$('#content').width()+'x300&location='+lat+','+lng+'&fov=90&heading='+heading+'&pitch='+pitch+'&sensor=false';

			var desc = 	'<div class="ui-grid-a">\
           			<div class="ui-block-a"><a href="#" class="ui-btn ui-corner-all" data-action="dirFrom" data-target="'+station.lat+','+station.lng+'">Directions From</a></div>\
                   	<div class="ui-block-b"><a href="#" class="ui-btn ui-corner-all" data-action="dirTo" data-target="'+station.lat+','+station.lng+'">Directions To</a></div>\
            </div>\
            <div data-name="img" style="height:300px; width:'+($('#content').width()-12)+'px;background-image: url('+img+');background-size:cover;">\
            		<a href="#" class="ui-btn ui-btn-inline marginl6" data-action="streetView" data-index="'+index+'" style="opacity:0.75; z-index:5; margin:0;">Open StreetView</a>\
            		<a href="#" class="ui-btn ui-btn-inline marginl6 hiding" data-action="saveView" data-index="'+index+'" style="opacity:0.75;z-index:5;">Save Current View</a>\
            	<span class="floatRight content" style="opacity:0.8;z-index:5;">Free Bikes: '+station.bikes+'<br>Empty Docks: '+station.docks+'</span>\
            </div>';

			$('#content').html(jqFactory.content(station.name, "",desc)).trigger('create');

	        openContent();
	        $.mobile.loading('hide');
		});
	};
	parent.getStreetView = function(index){
		$.mobile.loading('show');
		var station = parent.data.stations[index];
	    var query = serverPath+ "/server/bixi.php?command=getStationDB_v2&id="+station.id+"&cityTag="+cityTag;;
	    $.getJSON( query).complete(function(result) {
			var heading, latLng, pitch;
	        if(result.responseJSON.heading =="0"){
	        	heading =0;
	        	pitch = 0;
	        	latLng = station.latLng;
	        }
	        else{
	        	latLng = new google.maps.LatLng(result.responseJSON.lat,result.responseJSON.lng);
	        	heading = Number(result.responseJSON.heading);
	        	pitch = Number(result.responseJSON.pitch);
	        }
	        showStreetView(latLng, heading, pitch, "bixi" , station.index);
	        $.mobile.loading('hide');
	    });
	};
	parent.saveView = function(index){
		var station = parent.data.stations[index];
		var stationID = station.id;
		var heading = panorama.pov.heading;
		var lat = panorama.position.d;
		var lng = panorama.position.e;
		var pitch = panorama.pov.pitch;
		var query = serverPath+ "/server/bixi.php?command=updateStation";

		$.get(query, { stationID: station.id , heading:heading, pitch:pitch, lat:lat, lng:lng } )
			.done(function( data ) {
			alertMsg("Saved");
		});
	};
	parent.dir.getDir = function(){
		parent.data.dir = {};
		parent.dir.params(parent.dir.getStations);
	};
	parent.dir.getStations = function(params){
		var latLngSearch = new RegExp('^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?),\\s*[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$');
		var query1, query2;
		$.mobile.loading('show');
		if(latLngSearch.test(params.origin)==false){
			if (params.origin.search(/toronto/i)==-1){params.origin += " " + localStorage.currentCity;}
			query1 = $.getJSON( serverPath + '/server/main.php?command=getGeocode&address='+encodeURIComponent(params.origin));
		}
		if(latLngSearch.test(params.destination)==false){
			if (params.destination.search(/toronto/i)==-1){params.destination += " " + localStorage.currentCity;}
			query2 = $.getJSON( serverPath + '/server/main.php?command=getGeocode&address='+encodeURIComponent(params.destination));
		}
		$.when(query1, query2).done(function(data1, data2){
			var originlatLng, destLatLng, coord;
			var stations = parent.data.stations;
			params.inputOrg = params.origin;
			params.inputDest = params.destination;
			if(typeof data1!=='undefined'){
				params.origin = data1[0].results[0].geometry.location.lat + ',' +data1[0].results[0].geometry.location.lng;
			}
			if(typeof data2!=="undefined"){
				params.destination = data2[0].results[0].geometry.location.lat + ',' +data2[0].results[0].geometry.location.lng;
			}
			coord = params.origin.split(',');
			originlatLng = new google.maps.LatLng(coord[0],coord[1]);
			coord = params.destination.split(',');
			destLatLng = new google.maps.LatLng(coord[0],coord[1]);
			$.each(stations, function(i, station){
				stations[i].distanceOrigin = google.maps.geometry.spherical.computeDistanceBetween (originlatLng, station.latLng);
				stations[i].distanceDestination = google.maps.geometry.spherical.computeDistanceBetween (destLatLng, station.latLng);
			});
			stations.sort(function(a,b) {
	          return a.distanceOrigin - b.distanceOrigin;
	        });
	        $.each(stations, function(i, station){
	        	if (station.bikes>0){
	        		params.origin = stations[0].lat + "," + stations[0].lng;
	        		params.originStation = stations[0];
	        		return false;
	        	}
	        });
	        stations.sort(function(a,b) {
	          return a.distanceDestination - b.distanceDestination;
	        });
	        $.each(stations, function(i, station){
	        	if (station.docks>0){
	        		params.destination = stations[0].lat + "," + stations[0].lng;
	        		params.destStation = stations[0];
	        		return false;
	        	}
	        });

			$.mobile.loading('hide');
			parent.data.dir.input = params;
			parent.dir.getData(params);
		});

	};
	parent.dir.drawDir = function(dirData){
		var paths=[];
		var text="";
		var headline;
		var textDeets="";
		$.mobile.loading('show');

		$.each(dirData.routes, function(i, route){
			route.path = google.maps.geometry.encoding.decodePath(route.overview_polyline.points);
			route.colour = randomColour('normal');
			$.each(paths, function(k, value){
				if (value.pathEncode==route.overview_polyline.points){route.colour=value.strokeColor;}
			});
			paths.push(new google.maps.Polyline({
				path: route.path,
				pathEncode : route.overview_polyline.points,
				geodesic: true,
				strokeColor:  route.colour,
				strokeOpacity: 0.85,
				strokeWeight: 5,
				map:map
			}));

/*			textDeets += 	'<p>Depart at station near '+route.legs[0].start_address+'</p>\
						    <p>After '+route.legs[0].distance.text +' in '+route.legs[0].duration.text+'...</p>\
						    <p>Arrive at station near'+ route.legs[0].end_address +'</p>';
			text += jqFactory.li(textDeets,
	    		{btn:true, btnClass:"content ui-icon-arrow-r", btnAttr:'data-action="dirInfo" data-module="bixi" style="border-left: 2px solid '+route.colour+'"', header:route.summary});
*/			text += jqFactory.li("Trip length: " + route.legs[0].duration.text + "; Distance: " + route.legs[0].distance.text,
	           	{btn:true, btnClass:"content ui-icon-arrow-r", btnAttr:'data-action="dirInfo" data-module="bixi" style="border-left: 2px solid '+route.colour+'" data-index="'+i+'"', header:route.summary});

		});

		var southWest = new google.maps.LatLng(dirData.routes[0].bounds.southwest.lat,dirData.routes[0].bounds.southwest.lng);
		var northEast = new google.maps.LatLng(dirData.routes[0].bounds.northeast.lat,dirData.routes[0].bounds.northeast.lng);

		var bounds = new google.maps.LatLngBounds(southWest,northEast);
		map.fitBounds(bounds);

		parent.clearMap.all();
		parent.drawStations([parent.data.dir.input.originStation,parent.data.dir.input.destStation]);
		parent.data.dir = {};
		parent.data.dir.results = dirData.routes;
		$('#dir ul').html(text).listview().listview("refresh");
		$.mobile.loading('hide');
		parent.overlays.paths.directions = paths;
		localStorage.currentView="directions";
	};
	parent.dir.dirInfo = function(index){
	    parent.clearMap.all();
	    var route = parent.data.dir.results[index];
	    var text="";
	    var icon,colour;
	    var headline;
	    $.mobile.loading('show');
	    console.log(route);

	    $.each(route.legs[0].steps, function(i, step){
	        if(step.travel_mode=="BICYCLING"){icon = "bike";colour=route.colour;}

			text += jqFactory.li(step.html_instructions+'(For '+step.distance.text+' or '+step.duration.text+')',
	            	{btn:true, btnClass:"content ui-icon-"+icon});

	        parent.overlays.paths.directions.push(new google.maps.Polyline({
	            path:google.maps.geometry.encoding.decodePath(step.polyline.points),
	            geodesic: true,
	            strokeColor: colour,
	            strokeOpacity: 0.85,
	            strokeWeight: 5,
	            map:map
	        }));
	    });

		$('#content').html(jqFactory.content(route.summary, text)).trigger('create');
		$('#content ul').listview().listview('refresh');

	    $.mobile.loading('hide');
	};
}
function c2gService(){
	services.c2g = new service();
	var cityTag =servicesList.c2g[localStorage.currentCity].tag;
	var serviceColor;
	var parent = services.c2g;
	parent.name='c2g';
	parent.screenName = parent.name;
	parent.init = function(){
		cityTag=servicesList.c2g[localStorage.currentCity].tag;
		serviceColor=servicesList.c2g[localStorage.currentCity].color;
		google.maps.event.clearListeners(map, 'zoom_changed');
		parent.overlays.mc.cars = createMC('img/c2gCluster.png');
		parent.getCars(parent.drawCars);
	};
	parent.dash = function(){
		if(typeof parent.data.cars ==="undefined"){
			parent.getCars(writeDash);
		}
		else{writeDash();}
		function writeDash(){
			var location, attr, distance;
			var cars = parent.data.cars;
			serviceColor=servicesList.c2g[localStorage.currentCity].color;
			var text = '<li data-role="list-divider" style="border-left: 2px solid '+serviceColor+'">Nearest Car2Go Vehicles</li>';
			$.each(cars, function(i,car){
				location = new google.maps.LatLng(userPosition.lat,userPosition.lng);
				car.distance = google.maps.geometry.spherical.computeDistanceBetween (location, car.latLng);
			});

			cars.sort(function(a,b) {
		    	return a.distance - b.distance;
		    });

		  	$.each(cars, function(i, car){
				distance = Math.round(car.distance/10)/100;
		    	attr = 'data-module="c2g" data-action="createBooking" data-vin="'+car.vin+'"';

			  	text +=jqFactory.li("License Plate: " + car.name + "; Fuel: " + car.fuel + "%",
					{header:car.address, aside: distance + 'km', btn:true, btnClass:"paddingtb0 content ui-icon-car", btnAttr:attr});
		  		if (i==2){return false;}
		  	});

		  	$('#content ul[data-module="c2g"]').append(text).listview().listview('refresh');
		}
	};
	parent.getCars = function(cb){
		var query = "https://www.car2go.com/api/v2.1/vehicles?oauth_consumer_key=localMotion&format=json&loc="+cityTag+"&callback=?";
		$.mobile.loading('show');
		$.getJSON( query, function(data){
			$.each(data.placemarks, function(i, car){
				car.latLng = new google.maps.LatLng(car.coordinates[1],car.coordinates[0]);
			});
			parent.data.cars = data.placemarks;
			$.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.cars)};
		}).fail(function(xhr, status, error){
			alertMsg("Something wrong with getting data from the server.");
		});
	}
	parent.drawCars = function(mArray,cb){
	    var icon, markerContent;
	    var markersArray = [];
	    $.mobile.loading('show');
	    $.each(mArray, function(i,car){
	        markerContent=
	            "<div class='marker c2g "+imgRes.lm()+"' data-module='c2g' data-action='getDeets' data-vin='"+car.vin+"' data-index='"+i+"' ></div>";

	        markersArray.push(new RichMarker({
					position: car.latLng,
					draggable: false,
					clickable: true,
					flat:true,
					anchor: RichMarkerPosition.MIDDLE,
					content: markerContent
	        }));
	    });

		parent.overlays.mc.cars.addMarkers(markersArray);

	    google.maps.event.addListener(parent.overlays.mc.cars, 'clusterclick', function(cluster) {
			map.panTo(cluster.getCenter());
			var markers = cluster.getMarkers();
			var carIndex = [];
			var beginPos, endPos;
			$.each(markers, function(i,marker){
				beginPos = marker.content.indexOf("data-index")+12;
				endPos = marker.content.indexOf("'", beginPos);

				carIndex.push(marker.content.substr(beginPos, (endPos-beginPos)));
			});
			parent.carDeets(carIndex);
	    });

	    $.mobile.loading('hide');
	    if(typeof cb !=="undefined"){cb();}
	};
	parent.linkAccounts = function(){
		user.getInfo(function(){
         if(localStorage.c2gAccount !=""){
             alertMsg("You now have access to your car2go account");
         }
         else{
             alertMsg("Something went wrong.", "medium");
         }
     });
	}
	parent.getParking = function(callback){
	    $.mobile.loading('show');
	    var query = "https://www.car2go.com/api/v2.1/parkingspots?oauth_consumer_key=localMotion&format=json&loc="+cityTag+"&callback=?";
	    $.getJSON( query, function(data){
	    	$.each(data.placemarks, function(i, parking){
	            parking.latLng = new google.maps.LatLng(parking.coordinates[1],parking.coordinates[0]);
	        });
	        parent.data.parking = data.placemarks;
	        $.mobile.loading('hide');
	        if(typeof callback !=="undefined"){callback(parent.data.parking);}
	    }).fail(function(xhr, status, error){
	        alertMsg("Something wrong with getting data from the server.", 'medium');
	    });
	};
	parent.drawParking = function(pArray){
	    var position, markerContent;
	    var parkingArray = [];
	    $.mobile.loading('show');
		parent.clearMap.all();
	    $.each(pArray, function(i,parking){

			markerContent="<div class='marker c2g parking' data-module='c2g'></div>";
	        position = new google.maps.LatLng(parking.coordinates[1],parking.coordinates[0]);

	        parkingArray.push(
	            new RichMarker({
	        	position: position,
	        	draggable: false,
	            clickable: true,
	        	flat:true,
	        	anchor: RichMarkerPosition.MIDDLE,
	        	content: markerContent,
	        	map: map
	        }));

	        parent.overlays.markers.parking=parkingArray;

	        $.mobile.loading('hide');
	    });
	};
	parent.carDeets = function(indices){
	    $.mobile.loading('show');
	    var li = "";

		$.each(indices, function(i, index){
			li += jqFactory.li("License Plate: " + parent.data.cars[index].name + "; Fuel: " + parent.data.cars[index].fuel,
	    		{btn:true, btnClass:"content ui-icon-action", btnAttr:'data-action="createBooking" data-module="c2g"  data-vin = "'+parent.data.cars[index].vin+'"', header:parent.data.cars[index].address});
		});

	    map.panTo(parent.data.cars[indices[0]].latLng);
    	$('#content').html(jqFactory.content('Available Cars', li)).trigger('create');
        openContent();
		$.mobile.loading('hide');
	};
	parent.bingoFuel = function(){
		var markersArray=[];
		var markerContent
		parent.clearMap.all();
		$.each(parent.data.cars, function(i, car){
			if(car.fuel<=25){
				markerContent=
	                "<div class='marker c2g bingo "+imgRes.lm()+"' data-module='c2g' data-action='getDeets' data-vin='"+car.vin+"' data-index='"+i+"' ></div>";

				markersArray.push(
					new RichMarker({
					position: car.latLng,
					draggable: false,
					clickable: true,
					flat:true,
					anchor: RichMarkerPosition.MIDDLE,
					content: markerContent,
					map:map
	        	}));
			}
		});
		parent.overlays.markers.bingoFuel=markersArray;
	};
	parent.bookings = function(){
		if(typeof localStorage.email ==="undefined"){alertMsg('You must first login.'); return false;}
		if(typeof localStorage.c2gAccount ==="undefined"){alertMsg('You must link your car2go account.'); return false;}
	    var query =  serverPath + '/server/c2g.php?command=getBookingsv2&email='+encodeURIComponent(localStorage.email)+"&cityTag="+cityTag;
	    $.mobile.loading('show');
	    $.ajax({
	        type: "GET",
	        url: query,
	        dataType: "json",
	        success: function(data){
	        if(data.result=="No results"){
	    		alertMsg( "No current reservations.");
	            $.mobile.loading('hide');
	            return false;
	        }
	        if(data.result.returnValue.code==0){
	            var text="";
	            var markerContent;
	            var markers = [];

	            parent.clearMap.all();
				parent.overlays.markers.bookingMarkers = [];

	            $.each(data.result.booking, function(i, booking){
	                booking.latLng = new google.maps.LatLng(booking.bookingposition.latitude,booking.bookingposition.longitude);
	                map.panTo(booking.latLng);
	        		text += jqFactory.li("Fuel: " +booking.vehicle.fuel+ "%",
	    				{btn:true, btnClass:"content ui-icon-delete", btnAttr:'data-action="cancelBooking" data-module="c2g"  data-bookingID = "'+booking.bookingId+'"', header:booking.bookingposition.address});

	            	markerContent=
			            "<div class='marker c2g bingo "+imgRes.lm()+"' data-module='c2g' data-vin='"+booking.vehicle.vin+"'>\
			            	<div class='inner'>\
			        	</div></div>";

	                parent.overlays.markers.bookingMarkers.push(
	                    new RichMarker({
	                	position: booking.latLng,
	                	draggable: false,
	                    clickable: true,
	                	flat:true,
	                	anchor: RichMarkerPosition.MIDDLE,
	                	animation: google.maps.Animation.DROP,
	                	content: markerContent,
	                	index: i,
	                	map:map
	                }));
	            });
	            if (data.result.booking.length ===0){
					alertMsg( "No current reservations.");
		            $.mobile.loading('hide');
		            return false;
	            }
	            parent.overlays.markers.booking = markers;

	            parent.data.booking = data.booking;

		    	$('#content').html(jqFactory.content('Booking Details', text)).trigger('create');
		        openContent();
	            $.mobile.loading('hide');

	        }
	    }}).fail(function(xhr, status, error){
	        alertMsg("Something wrong with getting data from the server.", 'medium');
	    });
	};
	parent.createBooking = function(vin){
		if(typeof localStorage.email ==="undefined"){alertMsg('You must first login.'); return false;}
		if(typeof localStorage.c2gAccount ==="undefined"){alertMsg('You must link your car2go account.'); return false;}

	    $.mobile.loading('show');
	    var query =  serverPath + "/server/c2g.php?command=createBookingv2&email="+encodeURIComponent(localStorage.email) + "&vin=" + vin+"&cityTag="+cityTag;
	    $.getJSON( query, function( data ) {

	        if(data.result.returnValue.code==0){
	        	alertMsg("Car booked!", 'medium');
	            parent.bookings();
	        }
	        else if(data.result.returnValue.code==9){
	        	alertMsg("This vehicle cannot be booked.", 'medium');
	        }
	        $.mobile.loading('hide');
	    }).fail(function(xhr, status, error){
	        alertMsg("Something wrong with getting data from the server.", 'medium');
	    });
	};
	parent.cancelBooking = function(bookingID){
		if(typeof localStorage.email ==="undefined"){alertMsg('You must first login.'); return false;}
		if(typeof localStorage.c2gAccount ==="undefined"){alertMsg('You must link your car2go account.'); return false;}

	    var query =  serverPath + "/server/c2g.php?command=cancelBookingv2&email="+encodeURIComponent(localStorage.email) + "&bookingID=" + bookingID+"&cityTag="+cityTag;
	    $.getJSON( query, function( data ) {
	        if(data.result.returnValue.code==0){
	        	alertMsg("Booking cancelled.", 'medium');
	        	parent.clearMap.all();
	            parent.init();
	        }

	    }).fail(function(xhr, status, error){
	        alertMsg("Something wrong with getting data from the server.", 'medium');
	    });
	};
	parent.dir.getDir = function(){
		parent.data.dir = {};
		if(typeof parent.data.parking=="undefined"){
			parent.getParking(function(){
				parent.dir.params(parent.dir.getStations);
			});
		}
		else{
			parent.dir.params(parent.dir.getStations);
		}

	};
	parent.dir.getStations = function(params){
		var latLngSearch = new RegExp('^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?),\\s*[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$');
		var query1, query2;
		$.mobile.loading('show');
		if(latLngSearch.test(params.origin)==false){
			if (params.origin.search(/toronto/i)==-1){params.origin += " " + localStorage.currentCity;}
			query1 = $.getJSON( serverPath + '/server/main.php?command=getGeocode&address='+encodeURIComponent(params.origin));
		}
		if(latLngSearch.test(params.destination)==false){
			if (params.destination.search(/toronto/i)==-1){params.destination += " " + localStorage.currentCity;}
			query2 = $.getJSON( serverPath + '/server/main.php?command=getGeocode&address='+encodeURIComponent(params.destination));
		}
		$.when(query1, query2).done(function(data1, data2){
			var originlatLng, destLatLng, coord;
			var cars = parent.data.cars;
			var parkingSpots = parent.data.parking;
			params.inputOrg = params.origin;
			params.inputDest = params.destination;
			if(typeof data1!=='undefined'){
				params.origin = data1[0].results[0].geometry.location.lat + ',' +data1[0].results[0].geometry.location.lng;
			}
			if(typeof data2!=="undefined"){
				params.destination = data2[0].results[0].geometry.location.lat + ',' +data2[0].results[0].geometry.location.lng;
			}
			coord = params.origin.split(',');
			originlatLng = new google.maps.LatLng(coord[0],coord[1]);
			coord = params.destination.split(',');
			destLatLng = new google.maps.LatLng(coord[0],coord[1]);
			$.each(cars, function(i, car){
				car.distanceOrigin = google.maps.geometry.spherical.computeDistanceBetween (originlatLng, car.latLng);
			});
			$.each(parkingSpots, function(i, parking){
				parking.distanceDestination = google.maps.geometry.spherical.computeDistanceBetween (destLatLng, parking.latLng);
			});
			cars.sort(function(a,b) {
	          return a.distanceOrigin - b.distanceOrigin;
	        });
	        parkingSpots.sort(function(a,b) {
	          return a.distanceDestination - b.distanceDestination;
	        });

	        params.origin = cars[0].coordinates[1] + "," + cars[0].coordinates[0];
	        params.originStation = cars[0];
    		params.destination = parkingSpots[0].coordinates[1] + "," + parkingSpots[0].coordinates[0];
    		params.destStation = parkingSpots[0];
			$.mobile.loading('hide');
    		parent.data.dir.input = params;
			parent.dir.getData(params);

		});
	};

	parent.dir.drawDir = function(dirData){
		var paths=[];
		var text="";
		var headline;
		var textDeets="";
		var cost;
		if(localStorage.currentCity=="toronto"){cost=0.4633;}
		else if(localStorage.currentCity=="montreal"){cost=0.436905;}
		$.mobile.loading('show');

		$.each(dirData.routes, function(i, route){
			route.path = google.maps.geometry.encoding.decodePath(route.overview_polyline.points);
			route.colour = randomColour('normal');
			$.each(paths, function(k, value){
				if (value.pathEncode==route.overview_polyline.points){route.colour=value.strokeColor;}
			});
			paths.push(new google.maps.Polyline({
				path: route.path,
				pathEncode : route.overview_polyline.points,
				geodesic: true,
				strokeColor:  route.colour,
				strokeOpacity: 0.85,
				strokeWeight: 5,
				map:map
			}));
			var tripCost = Math.round(route.legs[0].duration.value/60) * cost;
			tripCost = tripCost.toFixed(2);
			textDeets = 	'<p>Depart at station near '+route.legs[0].start_address+'</p>\
						    <p> After '+route.legs[0].distance.text +' in '+route.legs[0].duration.text+'...</p>\
						    <p>Arrive at station near'+ route.legs[0].end_address +'</p>\
						    <p>Estimated cost is $'+tripCost+'</p>';
			text += jqFactory.li(textDeets,
	    		{btn:true, btnClass:"content ui-icon-arrow-r", header:route.summary,
	    		btnAttr:'data-action="dirInfo" data-index="'+i+'" data-module="c2g" style="border-left: 2px solid '+route.colour+'"'});
			//0.4633, 0.436905
		});

		var southWest = new google.maps.LatLng(dirData.routes[0].bounds.southwest.lat,dirData.routes[0].bounds.southwest.lng);
		var northEast = new google.maps.LatLng(dirData.routes[0].bounds.northeast.lat,dirData.routes[0].bounds.northeast.lng);

		var bounds = new google.maps.LatLngBounds(southWest,northEast);
		map.fitBounds(bounds);

		parent.clearMap.all();
		parent.drawParking([parent.data.dir.input.destStation]);
		parent.drawCars([parent.data.dir.input.originStation]);
		parent.data.dir = {};
		parent.data.dir.results = dirData.routes;
		$('#dir ul').html(text).listview().listview("refresh");
		$.mobile.loading('hide');
		parent.overlays.paths.directions = paths;
		localStorage.currentView="directions";
	};
	parent.dir.dirInfo = function(index){
	    parent.clearMap.all();
	    var route = parent.data.dir.results[index];
	    var text="";
	    var icon,colour;
	    var headline;
	    $.mobile.loading('show');
	    console.log(route);

	    $.each(route.legs[0].steps, function(i, step){
	        if(step.travel_mode=="DRIVING"){icon = "car";colour=route.colour;}

			text += jqFactory.li(step.html_instructions+'(For '+step.distance.text+' or '+step.duration.text+')',
	            	{btn:false, aside:(i+1)});

	        parent.overlays.paths.directions.push(new google.maps.Polyline({
	            path:google.maps.geometry.encoding.decodePath(step.polyline.points),
	            geodesic: true,
	            strokeColor: colour,
	            strokeOpacity: 0.85,
	            strokeWeight: 5,
	            map:map
	        }));
	    });

		$('#content').html(jqFactory.content(route.summary, text)).trigger('create');
		$('#content ul').listview().listview('refresh');

	    $.mobile.loading('hide');
	};
}
function goService(){
	services.go = new service();
	var parent = services.go;
	parent.name='go';
	parent.screenName = parent.name;
	parent.init = function(){
		//parent.overlays.mc.stops = createMC('img/goCluster.png');
		google.maps.event.clearListeners(map, 'zoom_changed');
		parent.clearMap.all();
		parent.getInitStops();
		//parent.getStopsList(parent.drawStops);
	};
	parent.getInitStops = function(){
		$.mobile.loading('show');
		$.post(serverPath+ "/server/go.php?command=getStops", function(data){
			data = $.parseJSON(data);
			console.log(data);
			$.each(data.data, function(i,value){
				if(value.stops.length==0){return true;}
				$.each(value.stops, function(i,stop){
					stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);
				});

			});
			parent.data.stops = data;
			drawMap();
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		})
		function drawMap(){
			var text ="";
			var icon, colour;
			var pathCoord;
			var stops=[];
			var icon, markerContent, strokeWeight;
		    var markersArray = [];
		    var bound = new google.maps.LatLngBounds();

			parent.clearMap.all();
			parent.overlays.paths.routes = [];

			$.each(parent.data.stops.data, function(i,route){
				pathCoord=[];
				if(route.stops.length==0){return true;}
				if(route.routeInfo.type==2){icon="streetcar";strokeWeight=5;}else{icon="bus";strokeWeight=3;}
				$.each(route.stops, function(i,stop){
	            	colour = "#"+route.routeInfo.colour;
					stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);
					pathCoord.push(stop.latLng);
					bound.extend(stop.latLng);
				markerContent=
			            "<div class='markersm busStop "+imgRes.lm()+"' data-module='go' data-action='stopInfo' data-stopID='"+stop.id+"'></div>";

			        markersArray.push(new RichMarker({
							position: stop.latLng,
							draggable: false,
							clickable: true,
							flat:true,
							anchor: RichMarkerPosition.MIDDLE,
							content: markerContent
			        }));


				});
				parent.overlays.paths.routes.push(new google.maps.Polyline({
					path: pathCoord,
					geodesic: true,
					strokeOpacity: 0.7,
					strokeColor: colour,
					strokeWeight: strokeWeight,
					map:map
				}));
			});

			var clusterStyles = [{
		        textColor: 'rgba(0, 0, 0, 0)',
		        textSize: 0,
		        fontWeight: 'normal',
		        fontFamily: 'Lato',
		        url: 'img/lo/busstopMarker.png',
		        height: 18,
		        width: 18,
		        anchorText: [0,0]
		    }];

		    var mcOptions = {gridSize: 50, maxZoom: null, styles:clusterStyles,zoomOnClick: false};

			parent.overlays.mc.stops = new MarkerClusterer(map, markersArray , mcOptions);

			parent.overlays.mc.stops.setCalculator(function(){
			    var index = 0;
			    return {
			        text: "",
			        index: index
			    };
			});

			google.maps.event.addListener(parent.overlays.mc.stops, 'clusterclick', function(cluster) {
				map.panTo(cluster.getCenter());
				var markers = cluster.getMarkers();
				var index = [];
				var beginPos, endPos;
				$.each(markers, function(i,marker){
					beginPos = marker.content.indexOf("data-stopID")+13;
					endPos = marker.content.indexOf("'", beginPos);

					index.push(marker.content.substr(beginPos, (endPos-beginPos)));
				});
				parent.stopInfo(index);
		    });
			map.fitBounds(bound);
			$.mobile.loading('hide');
		}
	}
	parent.listRoutes = function(){

		$.get(serverPath+ "/server/go.php", {command:"listRoutes"}, function(data){
			parent.data.routes=$.parseJSON(data);
			console.log(parent.data.routes);
			write();
            $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.stops)};
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});

		function write(){
			var text ="";
			var icon, colour, desc;
			var pathCoord=[];
			var stops=[];
			$.each(parent.data.routes, function(i, route){
            	if(route.type==2){icon="streetcar";}else{icon="bus";}
            	colour = "#"+route.colour;
        		text += jqFactory.li("",
    				{btn:true, btnClass:"content borderl2 ui-icon-"+icon,
    				btnAttr:'data-module="go" data-action="getRouteInfo" data-routeID = "'+route.id+'"' + " style='border-left-color:"+colour+" !important;'", header:route.name});
            });

		/*	text = '<li class="ui-field-contain full-width-slider">\
					<label for="goDateSelect">'+day+'</label>\
					<input  type="range" id="goDateSelect" min="0" max="6" value="'+dayValue+'"></li>\
					<li class="ui-field-contain full-width-slider">\
					<label for="goTimeSelect">'+time+'</label>\
					<input  type="range" id="goTimeSelect" min="0" max="95" value="'+timeVal+'"></li>\
					'+text;*/
			desc = '<div data-role="controlgroup" data-type="horizontal" data-mini="true">\
						<a href="#" class="ui-shadow ui-btn ui-corner-all ui-btn-icon-left ui-icon-info ui-btn-b ui-btn-active" data-action="setAction" data-target="getRouteInfo">Get Route Info</a>\
					    <a href="#" class="ui-shadow ui-btn ui-corner-all ui-btn-icon-left ui-icon-location ui-btn-b"  data-action="setAction" data-target="setMap">Set Default Map</a>\
					</div>';
	    	$('#content').html(jqFactory.content('GO Transit Routes', text, desc)).trigger('create');

	        openContent();
	        $.mobile.loading('hide');
		}
	}
	parent.showRoutes = function(routeArray){
		var routeStr="";
		$.mobile.loading('show');
		$.each(routeArray, function(i, route){
			routeStr +="'" + route +"',";
		});
		routeStr = encodeURIComponent(routeStr.substr(0,routeStr.length - 1));
		$.get(serverPath+ "/server/go.php", {command:'getStops', routeStr:routeStr}, function(data){
			data = $.parseJSON(data);
			console.log(data);
			$.each(data.data, function(i,value){
				if(value.stops.length==0){return true;}
				$.each(value.stops, function(i,stop){
					stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);
				});

			});
			parent.data.stops = data;
			drawMap();
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		})

		function drawMap(){
			var text ="";
			var icon, colour;
			var pathCoord;
			var stops=[];
			var icon, markerContent, strokeWeight;
		    var markersArray = [];
			var bound = new google.maps.LatLngBounds();

			parent.clearMap.all();
			parent.overlays.paths.routes = [];

			$.each(parent.data.stops.data, function(i,route){
				pathCoord=[];
				if(route.stops.length==0){return true;}
				if(route.routeInfo.type==2){icon="streetcar";strokeWeight=5;}else{icon="bus";strokeWeight=3;}
				$.each(route.stops, function(i,stop){
	            	colour = "#"+route.routeInfo.colour;
					stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);
					pathCoord.push(stop.latLng);
					bound.extend(stop.latLng);

				markerContent=
			            "<div class='markersm busStop "+imgRes.lm()+"' data-module='go' data-action='stopInfo' data-stopID='"+stop.id+"'></div>";

			        markersArray.push(new RichMarker({
							position: stop.latLng,
							draggable: false,
							clickable: true,
							flat:true,
							anchor: RichMarkerPosition.MIDDLE,
							content: markerContent
			        }));
				});
				parent.overlays.paths.routes.push(new google.maps.Polyline({
					path: pathCoord,
					geodesic: true,
					strokeOpacity: 0.7,
					strokeColor: colour,
					strokeWeight: strokeWeight,
					map:map
				}));
			});

			var clusterStyles = [{
		        textColor: 'rgba(0, 0, 0, 0)',
		        textSize: 0,
		        fontWeight: 'normal',
		        fontFamily: 'Lato',
		        url: 'img/lo/busstopMarker.png',
		        height: 18,
		        width: 18,
		        anchorText: [0,0]
		    }];

		    var mcOptions = {gridSize: 50, maxZoom: null, styles:clusterStyles,zoomOnClick: false};

			parent.overlays.mc.stops = new MarkerClusterer(map, markersArray , mcOptions);

			parent.overlays.mc.stops.setCalculator(function(){
			    var index = 0;
			    return {
			        text: "",
			        index: index
			    };
			});
			map.fitBounds(bound);
			$.mobile.loading('hide');
		}
	};
	parent.getRouteInfo=function(route){
		$.post(serverPath+ "/server/go.php?command=getStops", {routeStr:route}, function(data){
			parent.data.routes=$.parseJSON(data);
			console.log(parent.data.routes);
			drawMap();
            $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.stops)};
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});

		function drawMap(){
			var text ="";
			var icon, colour;
			var pathCoord;
			var stops=[];
			var icon, markerContent, strokeWeight, routeName;
		    var markersArray = [];
		    var bound = new google.maps.LatLngBounds();

			parent.clearMap.all();
			parent.overlays.paths.routes = [];

			$.each(parent.data.routes.data, function(i,route){
				pathCoord=[];
				if(route.stops.length==0){return true;}
				if(route.routeInfo.type==2){icon="streetcar";strokeWeight=5;}else{icon="bus";strokeWeight=3;}
				$.each(route.stops, function(j,stop){
	            	colour = "#"+route.routeInfo.colour;
					stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);
					pathCoord.push(stop.latLng);
					bound.extend(stop.latLng);

					markerContent="<div class='markersm busStop "+imgRes.lm()+"' data-module='go' data-action='stopInfo' data-stopID='"+stop.id+" data-routeID='"+i+"'></div>";

			        markersArray.push(new RichMarker({
							position: stop.latLng,
							draggable: false,
							clickable: true,
							flat:true,
							anchor: RichMarkerPosition.MIDDLE,
							content: markerContent
			        }));

					text += jqFactory.li("",
	    				{btn:true, btnClass:"content ui-icon-arrow-r",
	    				btnAttr:'data-module="go" data-action="stopInfo" data-stopID = "'+stop.id+'" data-routeID = "'+i+'"', header: stop.name});
				});
				parent.overlays.paths.routes.push(new google.maps.Polyline({
					path: pathCoord,
					geodesic: true,
					strokeOpacity: 0.7,
					strokeColor: colour,
					strokeWeight: strokeWeight,
					map:map
				}));
				routeName = route.routeInfo.name;
			});

			var clusterStyles = [{
		        textColor: 'rgba(0, 0, 0, 0)',
		        textSize: 0,
		        fontWeight: 'normal',
		        fontFamily: 'Lato',
		        url: 'img/lo/busstopMarker.png',
		        height: 18,
		        width: 18,
		        anchorText: [0,0]
		    }];

		    var mcOptions = {gridSize: 50, maxZoom: null, styles:clusterStyles,zoomOnClick: false};

			parent.overlays.mc.stops = new MarkerClusterer(map, markersArray , mcOptions);

			parent.overlays.mc.stops.setCalculator(function(){
			    var index = 0;
			    return {
			        text: "",
			        index: index
			    };
			});

			$('#content').html(jqFactory.content(routeName, text)).trigger('create');
			openContent();
			map.fitBounds(bound);
			$.mobile.loading('hide');
		}
	};
	parent.stopInfo=function(stopsArray, routeID){
		var date = new Date();
		var minutes, hour, time, day, stopName;
		var stopsStr = "";
		if(typeof dayValue!="undefined"){
			day = parent.getDayFromValue(dayValue);
			time = parent.getTimeFromValue(timeVal)
		}
		else{
			var dayValue=date.getDay();
			day = parent.getDayFromValue(dayValue);
			minutes = Math.round(date.getMinutes()/15);
			hour = date.getHours()*4;
			var timeVal=hour+minutes;
			time = parent.getTimeFromValue(timeVal);
		}

		parent.data.stopsArray = stopsArray;
		$.each(stopsArray, function(i, stop){
			stopsStr +="'" + stop +"',";
		});

		stopsStr = encodeURIComponent(stopsStr.substr(0,stopsStr.length - 1));

		$.get(serverPath+ "/server/go.php?command=stopInfo", {stopsStr:encodeURIComponent(stopsStr), routeID:encodeURIComponent(routeID), day:encodeURIComponent(day), time:encodeURIComponent(time)}, function(data){
			parent.data.stopInfo=$.parseJSON(data);
			console.log(parent.data.stopInfo);
			write();
	        $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.stops)};
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});

		function write(){
			var text='';
			var direction=[];
			$.each(parent.data.stopInfo.data, function(i, route){
				text += '<div data-role="collapsible-set" data-collapsed-icon="arrow-r" data-expanded-icon="arrow-r" data-iconpos="right">\
							<div data-role="collapsible">\
						        <h3>'+route.route.routeInfo.name+'</h3>\
						        <div class="ui-grid-c">';
					$.each(route.stop, function(j, trip){
						direction = createNull(trip[0]);
						text += '<div class="ui-block-a" style="width:40%; font-size:12px;">'+j+'</div>\
							    <div class="ui-block-b" style="text-align:right;width:20%; font-size:12px;">'+direction.trips[0].time+'</div>\
							    <div class="ui-block-c" style="text-align:right;width:20%; font-size:12px;">'+direction.trips[1].time+'</div>\
							    <div class="ui-block-d" style="text-align:right;width:20%; font-size:12px;">'+direction.trips[2].time+'</div>\
							    ';
						//if(trip.id == stopId){stopName =trip.name;}
						});
				text += "	</div></div>";
				text += '<div data-role="collapsible-set" data-collapsed-icon="arrow-l" data-expanded-icon="arrow-l" data-iconpos="right">\
				<div data-role="collapsible">\
			        <h3>'+route.route.routeInfo.name+'</h3>\
			        <div class="ui-grid-c">';
					$.each(route.stop, function(j, trip){
						direction = createNull(trip[1]);
						text += '<div class="ui-block-a" style="width:40%; font-size:12px;">'+j+'</div>\
							    <div class="ui-block-b" style="text-align:right;width:20%; font-size:12px;">'+direction.trips[0].time+'</div>\
							    <div class="ui-block-c" style="text-align:right;width:20%; font-size:12px;">'+direction.trips[1].time+'</div>\
							    <div class="ui-block-d" style="text-align:right;width:20%; font-size:12px;">'+direction.trips[2].time+'</div>\
							    ';
						});
				text += "	</div></div>";
			});
			text+="		</div>";
			$('#content').html(jqFactory.content("Schedule", "", text)).trigger('create');

	        openContent();

	        $.mobile.loading('hide');
		}
		function createNull(direction){
			if(typeof direction.trips[0] =="undefined"){direction.trips[0]={};direction.trips[0].time="";}
			if(typeof direction.trips[1] =="undefined"){direction.trips[1]={};direction.trips[1].time="";}
			if(typeof direction.trips[2] =="undefined"){direction.trips[2]={};direction.trips[2].time="";}
			return direction;
		}
	};

	parent.getStopsList = function(cb){
		$.mobile.loading('show');
		$.get(serverPath+ "/server/go.php", {command:'getStopsList'}, function(data){
			var text ="";
			var icon, content, position;
			var bound = new google.maps.LatLngBounds();
			var pathCoord=[];
			var markersArray = [];
			parent.data.stops=$.parseJSON(data);

			$.each(parent.data.stops, function(i,value){
				value.latLng = new google.maps.LatLng(value.lat, value.lng);
			});
			$.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.stops)};

		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});
	}
	parent.drawStops = function(mArray,cb){
		var icon, markerContent;
	    var markersArray = [];
	    $.mobile.loading('show');

	    $.each(mArray, function(i,stop){
	        markerContent=
	            "<div class='marker go "+imgRes.lm()+"' data-module='go' data-action='getDeets' data-stopID='"+stop.id+"'></div>";

	        markersArray.push(new RichMarker({
					position: stop.latLng,
					draggable: false,
					clickable: true,
					flat:true,
					anchor: RichMarkerPosition.MIDDLE,
					content: markerContent
	        }));
	    });

		var clusterStyles = [{
	        textColor: 'rgba(0, 0, 0, 0)',
	        textSize: 0,
	        fontWeight: 'normal',
	        fontFamily: 'Lato',
	        url: 'img/lo/busstopMarker.png',
	        height: 18,
	        width: 18,
	        anchorText: [0,0]
	    }];

	    var mcOptions = {gridSize: 50, maxZoom: null, styles:clusterStyles,zoomOnClick: false};

		parent.overlays.mc.stops = new MarkerClusterer(map, markersArray , mcOptions);

	    google.maps.event.addListener(parent.overlays.mc.stops, 'clusterclick', function(cluster) {
			map.panTo(cluster.getCenter());
			var markers = cluster.getMarkers();
			var stopIndex = [];
			var beginPos, endPos;
			$.each(markers, function(i,marker){
				beginPos = marker.content.indexOf("data-stopID")+13;
				endPos = marker.content.indexOf("'", beginPos);

				stopIndex.push(marker.content.substr(beginPos, (endPos-beginPos)));

			});
			parent.getRouteFromStops(stopIndex)
			//parent.carDeets(carIndex);
	    });

	    $.mobile.loading('hide');
	    if(typeof cb !=="undefined"){cb();}
	}
/*	parent.getRouteFromStops = function(stopsArray, dayValue, timeVal){
		var date = new Date();
		var minutes, hour, time, day;
		var stopsString = "";
		var postData={};
		$.mobile.loading('show');
		parent.data.stopsArray = stopsArray;
		$.each(stopsArray, function(i, stop){
			stopsString +="'" + stop +"',";
		});

		stopsString = encodeURIComponent(stopsString.substr(0,stopsString.length - 1));

		if(typeof dayValue!="undefined"){
			day = parent.getDayFromValue(dayValue);
			time = parent.getTimeFromValue(timeVal)
		}
		else{
			var dayValue=date.getDay();
			day = parent.getDayFromValue(dayValue);
			minutes = Math.round(date.getMinutes()/15);
			hour = date.getHours()*4;
			var timeVal=hour+minutes;
			time = parent.getTimeFromValue(timeVal);
		}

		postData.stopsString=stopsString;
		postData.day=day.toLowerCase();
		postData.time=time;
		console.log(postData);
		$.post(serverPath+ "/server/go.php?command=getRouteFromStops", postData, function(data){
			var text ="";
			var icon, colour;
			var pathCoord=[];
			var stops=[];

			parent.data.routes=$.parseJSON(data);

			parent.clearMap.all();
			parent.overlays.paths.routes = [];

            $.each(parent.data.routes, function(i, route){
            	if(route.type==2){icon="streetcar";}else{icon="bus";}
            	colour = "#"+route.colour;
        		text += jqFactory.li("",
    				{btn:true, btnClass:"content borderl2 ui-icon-"+icon,
    				btnAttr:'data-module="go" data-routeID = "'+route.bookingId+'"' + " style='border-left-color:"+colour+" !important;'",
    				header:route.name});
    			$.each(route.stops, function(i, stop){
					stop.latLng = new google.maps.LatLng(stop.lat, stop.lng);
					pathCoord.push(stop.latLng);
	            });
	            parent.drawStops(route.stops);
	            parent.overlays.paths.routes.push(new google.maps.Polyline({
					path: pathCoord,
					geodesic: true,
					strokeOpacity: 0.7,
					strokeColor: colour,
					strokeWeight: 5,
					map:map
				}));
            });

			text = '<li class="ui-field-contain full-width-slider">\
					<label for="goDateSelect">'+day+'</label>\
					<input  type="range" id="goDateSelect" min="0" max="6" value="'+dayValue+'"></li>\
					<li class="ui-field-contain full-width-slider">\
					<label for="goTimeSelect">'+time+'</label>\
					<input  type="range" id="goTimeSelect" min="0" max="95" value="'+timeVal+'"></li>\
					'+text;

	    	$('#content').html(jqFactory.content('GO Transit Routes', text)).trigger('create');

	        openContent();

            $.mobile.loading('hide');
			if(typeof cb!="undefined"){cb(parent.data.stops)};
		}).fail(function(xhr, status, error){
			alert("Something wrong with getting data from the server.");
		});
	};*/
	parent.changeTimeSlider = function(value){

		$('#goTimeSelect-label').html(parent.getTimeFromValue(value));
	};
	parent.changeDateSlider = function(value){
		//var days = ["Sun", "Mon","Tues","Wed", "Thurs", "Fri","Sat"];

		$('#goDateSelect-label').html(parent.getDayFromValue(value));
	};
	parent.getTimeFromValue = function(value){
		var hour = Math.floor(value / 4);
		var minutes = (value % 4) *15;
		if(minutes ==0){minutes="00";}
		var abbr = Math.floor(hour / 2);
		if(abbr>=6){abbr="PM";}else{abbr="AM";}
		//var time=hour + ":" + minutes + " " + abbr;
		var time=hour + ":" + minutes;
		return time;
	};
	parent.getDayFromValue = function(value){
		var days = ["Sunday", "Monday","Tuesday","Wednesday", "Thursday", "Friday","Saturday"];

		return days[value];
	};
	parent.clearMap.stops=function(){
		if(defined(parent.overlays.mc.stops)!=""){parent.overlays.mc.stops.clearMarkers()};
	};
}