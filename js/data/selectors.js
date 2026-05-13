// SRCON Demo Data Selectors

SRCON_DATA.getFilteredGrids = function(district,group){var g=this.grids;if(group&&group!=='all')g=g.filter(function(x){return x.stats[group]});if(district&&district!=='all')g=g.filter(function(x){return x.district===district});return g;};
SRCON_DATA.aggregateKPI = function(district,qk){var g=this.grids;if(district&&district!=='all')g=g.filter(function(x){return x.district===district});var t=0,u=new Set(),q=0;g.forEach(function(x){var s=x.stats[qk];if(s){t+=s.events;u.add(x.id);q+=s.qualityEvents}});return{events:t,users:u.size,qualityEvents:q,rate:t>0?parseFloat((q/t*100).toFixed(2)):0}};
