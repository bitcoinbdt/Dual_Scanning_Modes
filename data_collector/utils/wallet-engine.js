export function buildWalletData(transactions) {
  const wallets = {};
  
  transactions.forEach(tx => {
    if (!tx.wallets || !tx.transfers) {
      return;
    }
    
    tx.wallets.forEach(wallet => {
      if (!wallets[wallet]) {
        wallets[wallet] = {
          total_in: 0,
          total_out: 0,
          tx_count: 0
        };
      }
      wallets[wallet].tx_count++;
    });
    
    tx.transfers.forEach(transfer => {
      if (transfer.from && wallets[transfer.from]) {
        wallets[transfer.from].total_out += transfer.amount;
      }
      if (transfer.to && wallets[transfer.to]) {
        wallets[transfer.to].total_in += transfer.amount;
      }
    });
  });
  
  const holders = [];
  Object.keys(wallets).forEach(wallet => {
    const balance = wallets[wallet].total_in - wallets[wallet].total_out;
    if (balance > 0) {
      holders.push({
        wallet: wallet,
        balance: balance,
        tx_count: wallets[wallet].tx_count
      });
    }
  });
  
  holders.sort((a, b) => b.balance - a.balance);
  
  const metrics = {
    total_wallets: Object.keys(wallets).length,
    total_holders: holders.length,
    top_10_wallets: holders.slice(0, 10)
  };
  
  return {
    wallets,
    holders,
    metrics
  };
}
