import java.util.*; 
class allshortestpath 
{ 
public static void main(String args[]) 
{ 
int s,t,n,k,i,j,cost=0; 
int pre[],lengths[],status[],dist[][],path[]; 
final int INFINITY=100; 
System.out.println("the distance must be less than 100"); 
System.out.println("enter the number of routers"); 
Scanner x=new Scanner(System.in); 
n=x.nextInt(); 
path= new int[n]; 
dist=new int[n][n]; 
pre= new int[n]; 
lengths=new int[n]; 

status=new int[n]; 
System.out.println("ENTER COST MATRIX"); 

for(i=0;i<n;i++) 
{ 
for (j=0;j<n;j++) 
{ 
dist[i][j]=x.nextInt(); 
} 
System.out.println(""); 
} 
System.out.println("the graph is"); 
for(i=0;i<n;i++) 
{ 
for(j=0;j<n;j++) 
{ 
if((i!=j)&&(dist[i][j]==0)) 
{ 
dist[i][j]=INFINITY; 
} 
} 
}for(i=0;i<n;i++) 
{ 
for(j=0;j<n;j++) 
{ 
System.out.print(dist[i][j]+" "); 
} 
System.out.println(""); 
} 
System.out.println("enter the source node"); 
s=x.nextInt(); 
for(int p=1;p<n;p++) 
{ 
t=p; 
for(i=0;i<n;i++) 
{ 
pre[i]=-1;lengths[i]=INFINITY;status[i]=0; 
}
lengths[t]=0; 
status[t]=1; 
k=t; 
do 
{ 
for(i=0;i<n;i++) 

{ 
if(dist[k][i]!=0&&status[i]==0) 
{ 
if(lengths[k]+dist[k][i]<lengths[i]) 
{ 
pre[i]=k; 
lengths[i]=lengths[k]+dist[k][i]; 
} 
} 
 
}k=0; 
int min=INFINITY; 
for(i=0;i<n;i++) 
{ 
if(status[i]==0&&(lengths[i]<min)) 
{ 
min=lengths[i]; 
k=i; 
} 
}
status[k]=1; 
}while(k!=s); 
i=0; 
k=s; 
do 
{ 
path[i]=k; 
if(i!=0) 
cost=cost+dist[path[i-1]][path[i]]; 
k=pre[k]; 
i++; 
}while(k>=0); 
System.out.println("\n\nthe shortest path from source "+s+ "to destination "+p+" :"); 
for(k=0;k<i;k++) 
{ 
System.out.print(path[k]+"-->"); 
} 
System.out.print("cost"+cost); 
cost=0; 
} 
} 
} 
