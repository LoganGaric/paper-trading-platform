export const TestApp = (): JSX.Element => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Paper Trading Platform Test</h1>
      <p>If you can see this, React is working!</p>
      <button onClick={() => alert('Click works!')}>Test Button</button>
    </div>
  );
};