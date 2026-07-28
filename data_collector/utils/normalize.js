export function normalizeOHLCV(item) {
  return {
    timestamp: item.unixTime || item.timestamp,
    open: item.o || item.open,
    close: item.c || item.close,
    volume: item.v || item.volume
  };
}

export function normalizeTransaction(tx, targetMint) {
  if (!tx.timestamp) {
    return null;
  }
  
  const wallets = new Set();
  const transfers = [];
  
  if (tx.feePayer) {
    wallets.add(tx.feePayer);
  }
  
  if (tx.signature) {
    if (Array.isArray(tx.signature)) {
      tx.signature.forEach(sig => wallets.add(sig));
    }
  }
  
  if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
    tx.tokenTransfers.forEach(transfer => {
      if (targetMint && transfer.mint !== targetMint) {
        return;
      }
      
      if (transfer.fromUserAccount) {
        wallets.add(transfer.fromUserAccount);
        transfers.push({
          from: transfer.fromUserAccount,
          to: transfer.toUserAccount,
          amount: transfer.tokenAmount,
          type: 'token',
          mint: transfer.mint
        });
      }
      if (transfer.toUserAccount) {
        wallets.add(transfer.toUserAccount);
      }
    });
  }
  
  if (transfers.length === 0) {
    return null;
  }
  
  return {
    timestamp: tx.timestamp,
    wallets: Array.from(wallets),
    transfers: transfers
  };
}
