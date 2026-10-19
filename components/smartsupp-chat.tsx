import Script from "next/script";

const SMARTSUPP_KEY = "fdba5e41e232cfc35a4ee2b9df649eeef5458ea6";

export function SmartsuppChat() {
  return (
    <>
      <Script id="smartsupp-chat" strategy="afterInteractive">
        {`
          var _smartsupp = _smartsupp || {};
          _smartsupp.key = '${SMARTSUPP_KEY}';
          window.smartsupp||(function(d) {
            var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];
            s=d.getElementsByTagName('script')[0];c=d.createElement('script');
            c.type='text/javascript';c.charset='utf-8';c.async=true;
            c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);
          })(document);
        `}
      </Script>
      <noscript>
        Powered by{" "}
        <a href="https://www.smartsupp.com" target="_blank" rel="noreferrer">
          Smartsupp
        </a>
      </noscript>
    </>
  );
}
