      scanner.render((decodedText) => {
        if (decodedText === currentStage.unlockAnswer) {
          scanner.clear();
          setIsScanning(false);
          setSolved(true);
        } else {
          alert("這不是正確的二維碼喔！");
        }
      }, (_err) => {
        // 忽略掃描中的報錯
      });
