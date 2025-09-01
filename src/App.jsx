// import React from 'react';
// import CsvViewer from './Pages/CsvViwer';

// function App() {
//   return React.createElement(
//     'div',
//     { className: 'app' },
//     React.createElement(CsvViewer, null)
//   );
// }

// export default App;

import React, { useEffect, useState } from "react";
import LoginModal from './Component/Login/Login';
import CsvViewer from './Pages/CsvViwer';

function App() {
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
    setCheckingAuth(false);
  }, []);

  if (checkingAuth) return <div>Loading...</div>; // splash/loading state

  return (
    <div>
      {token ? (
        <CsvViewer />
      ) : (
         <LoginModal setToken={setToken} />
        
      )}
    </div>
  );
}

export default App;
