const dns = require("dns");

module.exports = {

	/**
	 * Returns the MX records for a specific domain
	 * 
	 * @param {string} domain Domain
	 * @returns {dns.MxRecord[]}
	 */
	mx (domain) {
		
		return new Promise((resolve, reject) => {
			
			if (domain === "localhost" || domain === "127.0.0.1") return resolve([{
					
				priority: 5,
				exchange: "localhost"
					
			}]);
			
			dns.resolveMx(domain, (err, addresses) => {
				
				if (err) resolve(false);
				else resolve(addresses.sort((a, b) => a.priority - b.priority));
				
			});
			
		});
		
	}

}
