// Razorpay checkout loader (for React)
(function(){
  if (!window.Razorpay) {
    var s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    document.body.appendChild(s);
  }
})();
