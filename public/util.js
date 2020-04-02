function primeFactors(x) {
	let f = [];
	for(let i = 2; i <= Math.sqrt(x); i++) {
		if(x % i === 0) {
			f.push([x / i, i]);
		}
	}
	return f
}